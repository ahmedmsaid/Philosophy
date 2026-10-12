import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BORDERS_DIR = path.join(ROOT_DIR, 'public', 'data', 'borders');
if (!fs.existsSync(BORDERS_DIR)) {
  fs.mkdirSync(BORDERS_DIR, { recursive: true });
}

const MVP_YEARS = [
  { year: -3000, filename: 'world_bc3000.geojson' },
  { year: -2000, filename: 'world_bc2000.geojson' },
  { year: -1500, filename: 'world_bc1500.geojson' },
  { year: -1000, filename: 'world_bc1000.geojson' },
  { year: -700, filename: 'world_bc700.geojson' },
  { year: -500, filename: 'world_bc500.geojson' },
  { year: -400, filename: 'world_bc400.geojson' },
  { year: -323, filename: 'world_bc323.geojson' },
  { year: -300, filename: 'world_bc300.geojson' },
  { year: -200, filename: 'world_bc200.geojson' },
  { year: -100, filename: 'world_bc100.geojson' },
  { year: -1, filename: 'world_bc1.geojson' }
];

const RAW_BASE = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/';

function roundCoord(num) {
  return Math.round(num * 10000) / 10000;
}

function processCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') {
    return [roundCoord(coords[0]), roundCoord(coords[1])];
  }
  return coords.map(processCoords);
}

function simplifyFeature(feature) {
  const geom = feature.geometry;
  if (!geom) return feature;

  return {
    type: 'Feature',
    properties: {
      NAME: feature.properties?.NAME || null,
      PARTOF: feature.properties?.PARTOF || null,
      SUBJECTO: feature.properties?.SUBJECTO || null,
      AREA: feature.properties?.AREA ? Math.round(feature.properties.AREA) : undefined
    },
    geometry: {
      type: geom.type,
      coordinates: processCoords(geom.coordinates)
    }
  };
}

async function fetchFile(filename) {
  const url = `${RAW_BASE}${filename}`;
  console.log(`⬇️  جاري تنزيل: ${filename}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`فشل تنزيل ${filename} (${res.status} ${res.statusText})`);
  }
  return await res.json();
}

async function main() {
  console.log('🗺️  بدء تنزيل وتبسيط ملفات الحدود التاريخية من aourednik/historical-basemaps...');

  const manifest = [];
  const uniqueNames = new Set();

  for (const item of MVP_YEARS) {
    const rawGeojson = await fetchFile(item.filename);
    const simplifiedFeatures = [];

    for (const feat of rawGeojson.features || []) {
      if (feat.properties?.NAME) {
        uniqueNames.add(feat.properties.NAME.trim());
      }
      if (feat.properties?.PARTOF) {
        uniqueNames.add(feat.properties.PARTOF.trim());
      }
      simplifiedFeatures.push(simplifyFeature(feat));
    }

    const optimized = {
      type: 'FeatureCollection',
      features: simplifiedFeatures
    };

    const outPath = path.join(BORDERS_DIR, item.filename);
    const jsonStr = JSON.stringify(optimized);
    fs.writeFileSync(outPath, jsonStr, 'utf-8');

    const sizeKb = Math.round((Buffer.byteLength(jsonStr, 'utf-8') / 1024) * 10) / 10;
    console.log(`  💾 تم حفظ ${item.filename}: ${simplifiedFeatures.length} كيان، الحجم: ${sizeKb} KB`);

    manifest.push({
      year: item.year,
      file: item.filename,
      featuresCount: simplifiedFeatures.length,
      sizeKb: sizeKb
    });
  }

  // Sort manifest by year (chronological, from -3000 to -1)
  manifest.sort((a, b) => a.year - b.year);
  const manifestPath = path.join(BORDERS_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n📋 تم إنشاء بيان ملفات الحدود (manifest.json) بنجاح.`);

  // Write/Update unique names list for translation
  const polityNamesFile = path.join(ROOT_DIR, 'content', 'polity-names-raw.json');
  fs.writeFileSync(
    polityNamesFile,
    JSON.stringify(Array.from(uniqueNames).sort(), null, 2),
    'utf-8'
  );
  console.log(`🏛️  تم استخراج ${uniqueNames.size} اسماً فريداً للكيانات السياسية في content/polity-names-raw.json`);
}

main().catch((err) => {
  console.error('❌ خطأ أثناء تحميل الحدود:', err);
  process.exit(1);
});
