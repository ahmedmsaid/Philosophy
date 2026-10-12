import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VALID_ERAS = new Set([
  'ancient-egypt',
  'mesopotamia',
  'ancient-persia',
  'ancient-india',
  'ancient-china',
  'presocratic',
  'classical-greek',
  'hellenistic'
]);

function loadJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function runValidation() {
  console.log('🔍 بدء التحقق من صحة بيانات الأطلس (Validating atlas data)...');

  let errorCount = 0;
  let warningCount = 0;

  function logError(file, id, msg) {
    errorCount++;
    console.error(`  ❌ [خطأ ${file}${id ? ` -> ${id}` : ''}]: ${msg}`);
  }

  function logWarning(file, id, msg) {
    warningCount++;
    console.warn(`  ⚠️  [تنبيه ${file}${id ? ` -> ${id}` : ''}]: ${msg}`);
  }

  // 1. Load schema
  const schemaPath = path.join(__dirname, 'schema', 'figure.schema.json');
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ لم يتم العثور على ملف المخطط (Schema file missing): ${schemaPath}`);
    process.exit(1);
  }
  const schema = loadJson(schemaPath);
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validateFigureSchema = ajv.compile(schema);

  // 2. Load civilizations
  const civsPath = path.join(ROOT_DIR, 'public', 'data', 'civilizations.json');
  if (!fs.existsSync(civsPath)) {
    console.error(`❌ لم يتم العثور على ملف الحضارات (civilizations.json missing): ${civsPath}`);
    process.exit(1);
  }
  const civilizations = loadJson(civsPath);
  const validCivIds = new Set(civilizations.map((c) => c.id));

  // 3. Scan content/figures/*.json
  const figuresDir = path.join(ROOT_DIR, 'content', 'figures');
  if (!fs.existsSync(figuresDir)) {
    console.error(`❌ المجلد content/figures غير موجود: ${figuresDir}`);
    process.exit(1);
  }

  const figureFiles = fs
    .readdirSync(figuresDir)
    .filter((file) => file.endsWith('.json'));

  const seenIds = new Map();
  const seenWikidata = new Map();
  let totalFigures = 0;

  for (const file of figureFiles) {
    const filePath = path.join(figuresDir, file);
    let figures;

    try {
      figures = loadJson(filePath);
    } catch (err) {
      logError(file, null, `ملف JSON غير صالح: ${err.message}`);
      continue;
    }

    if (!Array.isArray(figures)) {
      logError(file, null, 'محتوى الملف يجب أن يكون مصفوفة كائنات (Array of objects)');
      continue;
    }

    console.log(`📁 فحص ملف: ${file} (${figures.length} شخصية)`);

    for (let index = 0; index < figures.length; index++) {
      const figure = figures[index];
      const figId = figure.id || `عنصر #${index + 1}`;
      totalFigures++;

      // Schema check
      const valid = validateFigureSchema(figure);
      if (!valid) {
        for (const err of validateFigureSchema.errors) {
          logError(file, figId, `مخالفة للمخطط: ${err.instancePath} ${err.message}`);
        }
      }

      // Unique ID check
      if (figure.id) {
        if (seenIds.has(figure.id)) {
          logError(
            file,
            figId,
            `معرف مكرر (Duplicate id): "${figure.id}" ظهر سابقاً في ${seenIds.get(figure.id)}`
          );
        } else {
          seenIds.set(figure.id, file);
        }
      }

      // Unique Wikidata QID check
      if (figure.wikidata) {
        if (seenWikidata.has(figure.wikidata)) {
          logError(
            file,
            figId,
            `معرف ويكي بيانات مكرر (Duplicate QID): "${figure.wikidata}" ظهر سابقاً في ${seenWikidata.get(figure.wikidata)}`
          );
        } else {
          seenWikidata.set(figure.wikidata, file);
        }
      }

      // Civilization check
      if (figure.civilization && !validCivIds.has(figure.civilization)) {
        logError(
          file,
          figId,
          `حضارة غير معتمدة: "${figure.civilization}". الحضارات المسموحة: ${Array.from(validCivIds).join(', ')}`
        );
      }

      // Era check
      if (figure.era && !VALID_ERAS.has(figure.era)) {
        logError(
          file,
          figId,
          `حقبة غير معتمدة: "${figure.era}". الحقب المسموحة: ${Array.from(VALID_ERAS).join(', ')}`
        );
      }

      // Year 0 check (CONTEXT §4.1: there is no year 0)
      const yearsToCheck = [
        figure.birth?.year,
        figure.death?.year,
        figure.active?.from,
        figure.active?.to
      ];
      for (const yr of yearsToCheck) {
        if (yr === 0) {
          logError(file, figId, 'قاعدة السنة صفر: لا توجد سنة 0 في التاريخ (Negative = BCE, Positive = CE)');
        }
      }

      // Chronological ordering check
      if (figure.active) {
        if (typeof figure.active.from === 'number' && typeof figure.active.to === 'number') {
          if (figure.active.from > figure.active.to) {
            logError(
              file,
              figId,
              `ترتيب النشاط الزمني غير صحيح: active.from (${figure.active.from}) يجب أن يكون <= active.to (${figure.active.to})`
            );
          }
        }
      }

      if (figure.birth && typeof figure.birth.year === 'number') {
        if (figure.active && typeof figure.active.from === 'number') {
          if (figure.birth.year > figure.active.from) {
            logError(
              file,
              figId,
              `سنة الميلاد (${figure.birth.year}) يجب أن تكون <= بداية النشاط (${figure.active.from})`
            );
          }
        }
      }

      if (figure.death && typeof figure.death.year === 'number') {
        if (figure.active && typeof figure.active.to === 'number') {
          if (figure.active.to > figure.death.year) {
            logError(
              file,
              figId,
              `نهاية النشاط (${figure.active.to}) يجب أن تكون <= سنة الوفاة (${figure.death.year})`
            );
          }
        }
      }

      if (
        figure.birth &&
        typeof figure.birth.year === 'number' &&
        figure.death &&
        typeof figure.death.year === 'number'
      ) {
        if (figure.birth.year > figure.death.year) {
          logError(
            file,
            figId,
            `سنة الميلاد (${figure.birth.year}) يجب أن تكون <= سنة الوفاة (${figure.death.year})`
          );
        }
      }

      // Location checks
      if (figure.location) {
        const { lat, lng } = figure.location;
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
          logError(file, figId, `خط العرض غير صحيح (${lat})`);
        }
        if (typeof lng !== 'number' || lng < -180 || lng > 180) {
          logError(file, figId, `خط الطول غير صحيح (${lng})`);
        }
      }

      // Legendary / disputed historicity checks (CONTEXT §7 rule 5)
      if (figure.legendary === true) {
        if (!figure.notes || figure.notes.trim().length < 5) {
          logError(
            file,
            figId,
            'الشخصية شبه أسطورية (legendary: true) لكن حقل notes فارغ أو قصير جداً لتوضيح سبب الاختلاف'
          );
        }
        const hasApprox =
          (figure.birth && figure.birth.approx) ||
          (figure.death && figure.death.approx);
        if (!hasApprox) {
          logWarning(
            file,
            figId,
            'الشخصية شبه أسطورية ومن المستحسن أن يكون تاريخ الميلاد أو الوفاة مقترناً بـ approx: true'
          );
        }
      }

      // Check notes for unresolved verification flags
      if (figure.notes && figure.notes.includes('NEEDS VERIFICATION')) {
        logWarning(file, figId, `ملاحظة تحتاج مراجعة: ${figure.notes}`);
      }
    }
  }

  // 4. Validate public/data/figures.json if present
  const publicFiguresPath = path.join(ROOT_DIR, 'public', 'data', 'figures.json');
  if (fs.existsSync(publicFiguresPath)) {
    try {
      const publicFigures = loadJson(publicFiguresPath);
      if (Array.isArray(publicFigures)) {
        console.log(`\n📦 فحص الملف المولد public/data/figures.json (${publicFigures.length} شخصية)...`);
        for (const pubFig of publicFigures) {
          if (!pubFig.summary_ar && pubFig.wikipedia_ar) {
            logWarning('figures.json', pubFig.id, 'الملخص العربي summary_ar فارغ رغم وجود مقال ويكيبيديا');
          }
          if (!pubFig.fetched_at) {
            logWarning('figures.json', pubFig.id, 'حقل تاريخ الجلب fetched_at مفقود');
          }
        }
      }
    } catch (err) {
      logError('figures.json', null, `فشل قراءة public/data/figures.json: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=============================================');
  console.log(`📊 النتيجة الإجمالية:`);
  console.log(`   - إجمالي الشخصيات المفحوصة: ${totalFigures}`);
  console.log(`   - عدد الأخطاء (Errors): ${errorCount}`);
  console.log(`   - عدد التنبيهات (Warnings): ${warningCount}`);
  console.log('=============================================');

  if (errorCount > 0) {
    console.error('❌ فشل التحقق! يرجى إصلاح الأخطاء أعلاه.');
    process.exit(1);
  } else {
    console.log('✅ اكتمل التحقق بنجاح دون أي أخطاء.');
    process.exit(0);
  }
}

runValidation();
