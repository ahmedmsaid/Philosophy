/**
 * polish-ui.test.mjs - Unit tests for Phase 7 Polish & Metas
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('index.html contains required SEO, Open Graph, and semantic landmarks', () => {
  const htmlPath = path.join(rootDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Title and language
  assert.match(html, /<html\s+lang="ar"\s+dir="rtl">/i, 'html tag must have lang="ar" and dir="rtl"');
  assert.match(html, /<title>أطلس تاريخ الفلسفة \| Philosophy Timeline Atlas<\/title>/i, 'Must have Arabic title');
  assert.match(html, /<meta name="description"/i, 'Must have description meta tag');

  // Open Graph
  assert.match(html, /<meta property="og:title"/i, 'Must have og:title');
  assert.match(html, /<meta property="og:description"/i, 'Must have og:description');
  assert.match(html, /<meta property="og:image"\s+content="[^"]*og-atlas\.jpg"/i, 'Must have og:image pointing to og-atlas.jpg');
  assert.match(html, /<meta property="og:locale"\s+content="ar_AR"/i, 'Must have og:locale ar_AR');

  // Twitter cards
  assert.match(html, /<meta name="twitter:card"/i, 'Must have twitter:card');
  assert.match(html, /<meta name="twitter:title"/i, 'Must have twitter:title');

  // Landmarks & unique IDs
  assert.match(html, /<header id="app-header"/i, 'Must have header landmark');
  assert.match(html, /<h1 id="app-title">/i, 'Must have single h1');
  assert.match(html, /<main id="main-content"/i, 'Must have main landmark');
  assert.match(html, /<footer id="timeline-container"/i, 'Must have footer landmark');
  assert.match(html, /id="intro-btn"/i, 'Must have intro-btn in header');
  assert.match(html, /id="about-btn"/i, 'Must have about-btn in header');
  assert.match(html, /id="intro-overlay-mount"/i, 'Must have intro overlay mount');
  assert.match(html, /id="about-modal-mount"/i, 'Must have about modal mount');
});

test('OG banner image exists in public/images', () => {
  const imgPath = path.join(rootDir, 'public', 'images', 'og-atlas.jpg');
  assert.ok(fs.existsSync(imgPath), 'public/images/og-atlas.jpg must exist');
  const stats = fs.statSync(imgPath);
  assert.ok(stats.size > 10000, 'OG image must have valid image content');
});

test('IntroOverlay and AboutModal modules are correctly exported and functional', async () => {
  const { IntroOverlayComponent, INTRO_STORAGE_KEY } = await import('../src/ui/intro-overlay.js');
  const { AboutModalComponent } = await import('../src/ui/about-modal.js');

  assert.ok(typeof IntroOverlayComponent === 'function', 'IntroOverlayComponent must be a class/function');
  assert.equal(INTRO_STORAGE_KEY, 'atlas_intro_dismissed');
  assert.ok(typeof AboutModalComponent === 'function', 'AboutModalComponent must be a class/function');
});
