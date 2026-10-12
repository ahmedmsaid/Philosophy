import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const USER_AGENT =
  'PhilosophyTimelineAtlas/1.0 (https://github.com/dyabc/Philosophy; contact: atlas@philosophy-timeline.org)';
const CACHE_DIR = path.join(ROOT_DIR, '.cache');
const WIKI_CACHE_DIR = path.join(CACHE_DIR, 'wikipedia');
const WIKIDATA_CACHE_DIR = path.join(CACHE_DIR, 'wikidata');
const COMMONS_CACHE_DIR = path.join(CACHE_DIR, 'commons');

// Ensure cache directories exist
for (const dir of [CACHE_DIR, WIKI_CACHE_DIR, WIKIDATA_CACHE_DIR, COMMONS_CACHE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          ...(options.headers || {})
        }
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
  return null;
}

function sanitizeKey(str) {
  return encodeURIComponent(str).replace(/%/g, '_');
}

async function getWikidataEntity(qid, force = false) {
  const cacheFile = path.join(WIKIDATA_CACHE_DIR, `${qid}.json`);
  if (!force && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks|claims&format=json`;
  const data = await fetchWithRetry(url);
  await sleep(250); // Respect Wikimedia API rate limits

  if (data?.entities?.[qid]) {
    fs.writeFileSync(cacheFile, JSON.stringify(data.entities[qid], null, 2), 'utf-8');
    return data.entities[qid];
  }
  return null;
}

async function getWikipediaSummary(title, force = false) {
  if (!title) return null;
  const key = sanitizeKey(title);
  const cacheFile = path.join(WIKI_CACHE_DIR, `${key}.json`);
  if (!force && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  const url = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await fetchWithRetry(url);
  await sleep(250); // Respect Wikimedia API rate limits

  if (data) {
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
  }
  return data;
}

async function getCommonsImageMetadata(fileName, force = false) {
  if (!fileName) return null;
  const key = sanitizeKey(fileName);
  const cacheFile = path.join(COMMONS_CACHE_DIR, `${key}.json`);
  if (!force && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(
    fileName
  )}&prop=imageinfo&iiprop=url|extmetadata&format=json`;
  const data = await fetchWithRetry(url);
  await sleep(250);

  if (data?.query?.pages) {
    const pageId = Object.keys(data.query.pages)[0];
    const info = data.query.pages[pageId]?.imageinfo?.[0];
    if (info) {
      const ext = info.extmetadata || {};
      const metadata = {
        url: info.url,
        thumb_url: info.thumburl || info.url,
        license: ext.LicenseShortName?.value || ext.License?.value || 'Public Domain / Fair Use',
        author: ext.Artist?.value?.replace(/<[^>]+>/g, '').trim() || 'Unknown',
        source_url: ext.ImageDescription?.value ? info.descriptionurl : info.url
      };
      fs.writeFileSync(cacheFile, JSON.stringify(metadata, null, 2), 'utf-8');
      return metadata;
    }
  }
  return null;
}

async function main() {
  const force = process.argv.includes('--force');
  console.log('🌐 جاري جلب وإثراء بيانات الشخصيات من ويكيبيديا وويكي بيانات...');
  if (force) console.log('🔄 تم تفعيل التحديث القسري (--force)');

  const figuresDir = path.join(ROOT_DIR, 'content', 'figures');
  const figureFiles = fs.readdirSync(figuresDir).filter((f) => f.endsWith('.json'));

  const allFigures = [];
  const missingArticles = [];
  const qidMismatches = [];

  for (const file of figureFiles) {
    const filePath = path.join(figuresDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(content)) {
      allFigures.push(...content);
    }
  }

  console.log(`📋 إجمالي الشخصيات المطلوب معالجتها: ${allFigures.length}`);

  const enrichedFigures = [];

  for (let i = 0; i < allFigures.length; i++) {
    const fig = allFigures[i];
    console.log(`[${i + 1}/${allFigures.length}] معالجة: ${fig.name_ar} (${fig.id} - ${fig.wikidata})...`);

    // 1. Check Wikidata entity
    const entity = await getWikidataEntity(fig.wikidata, force);
    if (!entity) {
      console.warn(`  ⚠️  تعذر العثور على عنصر ويكي بيانات: ${fig.wikidata}`);
    } else {
      // Sitelink verification
      const arwikiSitelink = entity.sitelinks?.arwiki?.title;
      if (fig.wikipedia_ar) {
        if (!arwikiSitelink) {
          console.warn(
            `  ⚠️  عنصر ويكي بيانات ${fig.wikidata} لا يحتوي sitelink لمقالة arwiki، ولكن تم تحديد "${fig.wikipedia_ar}" يدويًا.`
          );
        } else {
          const normFigureTitle = fig.wikipedia_ar.replace(/_/g, ' ').trim();
          const normWikiTitle = arwikiSitelink.replace(/_/g, ' ').trim();
          if (normFigureTitle !== normWikiTitle) {
            const mismatchMsg = `عدم تطابق في عنوان المقال: في البيانات "${normFigureTitle}"، في ويكي بيانات "${normWikiTitle}"`;
            console.error(`  ❌ خطأ فادح: ${mismatchMsg}`);
            qidMismatches.push({
              id: fig.id,
              wikidata: fig.wikidata,
              declared: normFigureTitle,
              wikidata_title: normWikiTitle
            });
          }
        }
      } else if (arwikiSitelink) {
        console.info(`  💡 مقال متاح على arwiki في ويكي بيانات: "${arwikiSitelink}" (يمكن إضافته للملف)`);
      }
    }

    // 2. Fetch Wikipedia summary
    let summaryData = null;
    if (fig.wikipedia_ar) {
      try {
        summaryData = await getWikipediaSummary(fig.wikipedia_ar, force);
      } catch (err) {
        console.warn(`  ⚠️  فشل جلب ملخص ويكيبيديا لـ "${fig.wikipedia_ar}": ${err.message}`);
      }
    }

    // 3. Image extraction (from Commons P18 or Wikipedia summary)
    let imageData = null;
    let imageFileName = null;
    if (entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value) {
      imageFileName = entity.claims.P18[0].mainsnak.datavalue.value;
    }

    if (imageFileName) {
      try {
        imageData = await getCommonsImageMetadata(imageFileName, force);
      } catch (err) {
        console.warn(`  ⚠️  فشل جلب بيانات الصورة من كومنز: ${err.message}`);
      }
    }

    if (!imageData && summaryData?.thumbnail) {
      imageData = {
        url: summaryData.thumbnail.source,
        license: 'Wikipedia / Fair Use',
        author: 'Wikipedia Contributor',
        source_url: summaryData.content_urls?.desktop?.page || ''
      };
    }

    // 4. Missing article tracking
    if (!summaryData?.extract) {
      missingArticles.push({
        id: fig.id,
        name_ar: fig.name_ar,
        name_en: fig.name_en,
        civilization: fig.civilization,
        wikipedia_ar: fig.wikipedia_ar,
        wikidata: fig.wikidata
      });
    }

    // 5. Build enriched figure
    const enriched = {
      ...fig,
      summary_ar: summaryData?.extract || null,
      summary_source: summaryData?.extract ? 'wikipedia_ar' : 'manual',
      wikipedia_url: summaryData?.content_urls?.desktop?.page || (fig.wikipedia_ar ? `https://ar.wikipedia.org/wiki/${encodeURIComponent(fig.wikipedia_ar)}` : null),
      image: imageData || null,
      fetched_at: new Date().toISOString()
    };

    enrichedFigures.push(enriched);
  }

  // Abort on strict QID mismatches
  if (qidMismatches.length > 0) {
    console.error('\n❌ فشل العملية بسبب عدم تطابق معرفات ويكي بيانات مع عناوين المقالات:');
    for (const m of qidMismatches) {
      console.error(`   - ${m.id} (${m.wikidata}): المعطى "${m.declared}" != في ويكي بيانات "${m.wikidata_title}"`);
    }
    process.exit(1);
  }

  // Save public/data/figures.json
  const outDir = path.join(ROOT_DIR, 'public', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'figures.json');
  fs.writeFileSync(outPath, JSON.stringify(enrichedFigures, null, 2), 'utf-8');
  console.log(`\n✅ تم حفظ البيانات المثرية في: ${outPath} (${enrichedFigures.length} شخصية)`);

  // Report missing articles
  if (missingArticles.length > 0) {
    console.log(`\n📢 تقرير الشخصيات التي تفتقر لمقال كامل أو ملخص في ويكيبيديا العربية (${missingArticles.length}):`);
    for (const m of missingArticles) {
      console.log(`   - [${m.civilization}] ${m.name_ar} (${m.name_en}) - QID: ${m.wikidata}`);
    }
  } else {
    console.log('🎉 جميع الشخصيات الحالية لديها مقالات وملخصات متوفرة في ويكيبيديا العربية!');
  }
}

main().catch((err) => {
  console.error('❌ خطأ غير متوقع أثناء تنفيذ fetch-wikipedia.mjs:', err);
  process.exit(1);
});
