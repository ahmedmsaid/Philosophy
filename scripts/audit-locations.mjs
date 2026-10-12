/**
 * audit-locations.mjs - Philosophy Timeline Atlas
 * Compares figure coordinates with Wikidata P625 coordinates for the place of main activity.
 * 
 * Rules (CONTEXT §4.2, §7 rule 4 and PLAN T8.1):
 * - location.place_wikidata is required on every figure (^Q\\d+$).
 * - Coordinates describe the city/site where the figure was mainly active.
 * - Distance between location.lat/lng and Wikidata P625 must be <= 25 km.
 * - (0, 0) coordinates are rejected.
 * - Unresolved / unknown locations must have lat: null, lng: null and notes containing "NEEDS VERIFICATION: location".
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const USER_AGENT = 'PhilosophyTimelineAtlas/1.0 (https://github.com/dyabc/Philosophy; contact: atlas@philosophy-timeline.org)';
const CACHE_DIR = path.join(ROOT_DIR, '.cache');
const WIKIDATA_CACHE_DIR = path.join(CACHE_DIR, 'wikidata');

if (!fs.existsSync(WIKIDATA_CACHE_DIR)) {
  fs.mkdirSync(WIKIDATA_CACHE_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getWikidataEntity(qid, force = false) {
  const cacheFile = path.join(WIKIDATA_CACHE_DIR, `${qid}.json`);
  if (!force && fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } catch {
      // ignore cache read error
    }
  }

  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels|claims&format=json`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entity = data?.entities?.[qid];
      if (entity) {
        fs.writeFileSync(cacheFile, JSON.stringify(entity, null, 2), 'utf-8');
        return entity;
      }
      return null;
    } catch (err) {
      if (i === 2) {
        console.warn(`  ⚠️ فشل جلب ويكي بيانات ${qid}: ${err.message}`);
        return null;
      }
      await sleep(1000 * (i + 1));
    }
  }
  return null;
}

export async function runAudit(options = {}) {
  const isFixMode = process.argv.includes('--fix') || options.fix;
  console.log('🌍 بدء تدقيق مواقع الأعلام والمقارنة مع ويكي بيانات (P625)...');

  const figuresDir = path.join(ROOT_DIR, 'content', 'figures');
  const files = fs.readdirSync(figuresDir).filter((f) => f.endsWith('.json'));

  const report = [];
  let flagCount = 0;
  let unresolvedCount = 0;
  let verifiedCount = 0;

  // Collect all unique place QIDs to batch-fetch if needed
  const placeQidsToFetch = new Set();
  const figureList = [];

  for (const file of files) {
    const filePath = path.join(figuresDir, file);
    const figures = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    for (const fig of figures) {
      figureList.push({ file, filePath, fig });
      if (fig.location?.place_wikidata) {
        placeQidsToFetch.add(fig.location.place_wikidata);
      }
    }
  }

  // Pre-fetch place entities in small batches with rate limiting
  const uncachedQids = Array.from(placeQidsToFetch).filter((qid) => {
    const cacheFile = path.join(WIKIDATA_CACHE_DIR, `${qid}.json`);
    return !fs.existsSync(cacheFile);
  });

  if (uncachedQids.length > 0) {
    console.log(`📡 جلب بيانات ${uncachedQids.length} كيان جغرافي من ويكي بيانات...`);
    const BATCH_SIZE = 25;
    for (let i = 0; i < uncachedQids.length; i += BATCH_SIZE) {
      const batch = uncachedQids.slice(i, i + BATCH_SIZE);
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=labels|claims&format=json`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (res.ok) {
          const data = await res.json();
          for (const qid of batch) {
            const entity = data?.entities?.[qid];
            if (entity) {
              fs.writeFileSync(path.join(WIKIDATA_CACHE_DIR, `${qid}.json`), JSON.stringify(entity, null, 2), 'utf-8');
            }
          }
        }
      } catch (err) {
        console.warn(`تحذير أثناء جلب دفعة ويكي بيانات: ${err.message}`);
      }
      await sleep(300);
    }
  }

  // Audit each figure
  const fileFiguresMap = new Map();

  for (const { file, filePath, fig } of figureList) {
    const loc = fig.location;
    const item = {
      file,
      id: fig.id,
      name_ar: fig.name_ar,
      place_ar: loc?.place_ar || 'غير محدد',
      place_wikidata: loc?.place_wikidata || null,
      current_coords: null,
      wiki_coords: null,
      distance_km: null,
      status: 'OK',
      reason: ''
    };

    if (!loc) {
      item.status = 'FLAGGED';
      item.reason = 'حقل location مفقود بالكامل';
      flagCount++;
      report.push(item);
      continue;
    }

    if (!loc.place_wikidata) {
      item.status = 'FLAGGED';
      item.reason = 'حقل location.place_wikidata مفقود';
      flagCount++;
      report.push(item);
      continue;
    }

    if (!/^Q[1-9]\d*$/.test(loc.place_wikidata)) {
      item.status = 'FLAGGED';
      item.reason = `معرف المكان غير صالح (${loc.place_wikidata})`;
      flagCount++;
      report.push(item);
      continue;
    }

    // Check unresolved location (lat: null, lng: null)
    const isNullCoords = loc.lat === null && loc.lng === null;
    if (isNullCoords) {
      const hasNote = fig.notes && fig.notes.includes('NEEDS VERIFICATION: location');
      if (hasNote) {
        item.status = 'UNRESOLVED';
        item.reason = 'موقع غير محسوم / مختلف عليه (موثق بـ NEEDS VERIFICATION)';
        unresolvedCount++;
        report.push(item);
        continue;
      } else {
        item.status = 'FLAGGED';
        item.reason = 'إحداثيات فارغة null دون ملاحظة NEEDS VERIFICATION: location';
        flagCount++;
        report.push(item);
        continue;
      }
    }

    // Check (0, 0)
    if (loc.lat === 0 && loc.lng === 0) {
      item.status = 'FLAGGED';
      item.reason = 'الإحداثيات عند (0, 0) مرفوضة تماماً';
      flagCount++;
      report.push(item);
      continue;
    }

    item.current_coords = `(${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`;

    // Fetch entity from cache
    const entity = await getWikidataEntity(loc.place_wikidata);
    if (!entity) {
      item.status = 'FLAGGED';
      item.reason = `لم يتم العثور على الكيان ${loc.place_wikidata} في ويكي بيانات`;
      flagCount++;
      report.push(item);
      continue;
    }

    const p625 = entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (!p625 || typeof p625.latitude !== 'number' || typeof p625.longitude !== 'number') {
      item.status = 'FLAGGED';
      item.reason = `الكيان ${loc.place_wikidata} لا يحتوي على خاصية الإحداثيات P625 في ويكي بيانات`;
      flagCount++;
      report.push(item);
      continue;
    }

    item.wiki_coords = `(${p625.latitude.toFixed(4)}, ${p625.longitude.toFixed(4)})`;
    const dist = haversineKm(loc.lat, loc.lng, p625.latitude, p625.longitude);
    item.distance_km = Math.round(dist * 10) / 10;

    if (dist > 25) {
      item.status = 'FLAGGED';
      item.reason = `المسافة عن ويكي بيانات (${item.distance_km} كم) تتجاوز الحد المسموح (25 كم)`;
      flagCount++;
    } else {
      verifiedCount++;
    }

    report.push(item);
  }

  // Print report
  console.log('\n========================================================================================');
  console.log('📋 تقرير تدقيق مواقع أعلام الفلسفة (Location Audit Report):');
  console.log('========================================================================================');
  console.log(
    'الشخصية'.padEnd(18) +
    'المكان'.padEnd(24) +
    'QID المكان'.padEnd(12) +
    'إحداثيات الحالية'.padEnd(24) +
    'إحداثيات P625'.padEnd(24) +
    'المسافة'.padEnd(10) +
    'الحالة'
  );
  console.log('----------------------------------------------------------------------------------------');

  for (const r of report) {
    const symbol = r.status === 'OK' ? '✅' : r.status === 'UNRESOLVED' ? '⚠️ ' : '❌';
    console.log(
      r.id.padEnd(18) +
      r.place_ar.padEnd(24) +
      (r.place_wikidata || '-').padEnd(12) +
      (r.current_coords || '-').padEnd(24) +
      (r.wiki_coords || '-').padEnd(24) +
      (r.distance_km !== null ? `${r.distance_km} كم` : '-').padEnd(10) +
      `${symbol} ${r.status}${r.reason ? ` (${r.reason})` : ''}`
    );
  }

  console.log('========================================================================================');
  console.log(`📊 الخلاصة:`);
  console.log(`   - إجمالي الشخصيات المفحوصة: ${report.length}`);
  console.log(`   - مواقع مؤكدة ومطابقة (<= 25 كم): ${verifiedCount}`);
  console.log(`   - مواقع غير محسومة (معتمدة بـ NEEDS VERIFICATION): ${unresolvedCount}`);
  console.log(`   - مخالفات تم رصدها (FLAGGED): ${flagCount}`);
  console.log('========================================================================================\n');

  if (flagCount > 0) {
    console.error(`❌ فشل التدقيق! يوجد ${flagCount} موقع غير مطابق أو يحتاج إلى تصحيح في content/figures/*.json.`);
    if (!options.silent) process.exit(1);
    return false;
  } else {
    console.log('✅ اكتمل تدقيق المواقع بنجاح! جميع المواقع متطابقة أو موثقة بسلامة.');
    return true;
  }
}

// Run when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runAudit();
}
