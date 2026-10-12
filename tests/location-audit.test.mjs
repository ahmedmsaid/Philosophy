import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('Location data audit & schema compliance (Phase 8 T8.1, T8.2)', () => {
  const figuresDir = path.join(ROOT_DIR, 'content', 'figures');
  const files = fs.readdirSync(figuresDir).filter((f) => f.endsWith('.json'));

  let totalFigures = 0;
  let unresolvedCount = 0;

  for (const file of files) {
    const figures = JSON.parse(fs.readFileSync(path.join(figuresDir, file), 'utf-8'));
    for (const fig of figures) {
      totalFigures++;
      const loc = fig.location;

      // 1. location is required
      assert.ok(loc, `Figure ${fig.id} in ${file} must have a location object`);

      // 2. place_ar and modern_country_ar are non-empty strings
      assert.ok(loc.place_ar && loc.place_ar.trim().length > 0, `Figure ${fig.id} must have non-empty place_ar`);
      assert.ok(loc.modern_country_ar && loc.modern_country_ar.trim().length > 0, `Figure ${fig.id} must have non-empty modern_country_ar`);

      // 3. place_wikidata matches ^Q[1-9]\d*$
      assert.match(loc.place_wikidata, /^Q[1-9]\d*$/, `Figure ${fig.id} place_wikidata must be a valid QID`);

      // 4. (0, 0) coordinates are rejected
      assert.notEqual(loc.lat === 0 && loc.lng === 0, true, `Figure ${fig.id} coordinates (0, 0) are strictly rejected`);

      // 5. null coordinates require NEEDS VERIFICATION note
      if (loc.lat === null || loc.lng === null) {
        assert.equal(loc.lat, null, `Figure ${fig.id} lat and lng must both be null when unresolved`);
        assert.equal(loc.lng, null, `Figure ${fig.id} lat and lng must both be null when unresolved`);
        assert.ok(
          fig.notes && fig.notes.includes('NEEDS VERIFICATION'),
          `Figure ${fig.id} with null coords must have NEEDS VERIFICATION note`
        );
        unresolvedCount++;
      } else {
        // 6. Valid geographic range
        assert.ok(typeof loc.lat === 'number' && loc.lat >= -90 && loc.lat <= 90, `Figure ${fig.id} lat in range`);
        assert.ok(typeof loc.lng === 'number' && loc.lng >= -180 && loc.lng <= 180, `Figure ${fig.id} lng in range`);
      }
    }
  }

  assert.ok(totalFigures >= 50, `Expected at least 50 figures across MVP civilizations, found ${totalFigures}`);
  assert.equal(unresolvedCount, 1, 'Expected exactly 1 unresolved figure (Laozi)');
});
