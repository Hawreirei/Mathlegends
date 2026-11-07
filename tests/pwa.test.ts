/** Installable, offline game (#51): the manifest and service worker generators. */
import { describe, expect, it } from 'vitest';
import { cacheVersion, manifest, precacheList, serviceWorker } from '../scripts/pwa';

const BASE = '/Mathlegends/';
const m = JSON.parse(
  manifest({
    base: BASE,
    name: 'MathLegends',
    description: 'd',
    lang: 'id',
    background: '#19204c',
    theme: '#19204c',
  }),
) as Record<string, unknown> & { icons: { sizes: string; purpose: string; type: string }[] };

describe('manifest', () => {
  it('starts and stays inside the GitHub Pages path (case-sensitive)', () => {
    expect(m.start_url).toBe(BASE);
    expect(m.scope).toBe(BASE);
    expect(m.id).toBe(BASE);
    for (const i of m.icons)
      expect((i as unknown as { src: string }).src.startsWith(BASE)).toBe(true);
  });

  it('has what Android needs to install: name, full screen, 192 and 512 PNG icons, a maskable one', () => {
    expect(m.name).toBe('MathLegends');
    expect(m.short_name).toBe('MathLegends');
    expect(m.display).toBe('fullscreen');
    const png = m.icons.filter((i) => i.type === 'image/png');
    expect(png.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('precache list', () => {
  const files = precacheList([
    'index.html',
    'sw.js',
    'assets/index-abc.js',
    'assets/font.woff2',
    'assets/font.woff',
    'icons/icon-192.png',
  ]);

  it('stores the start page as the base path, not index.html, and never the worker itself', () => {
    expect(files).toContain('');
    expect(files).not.toContain('index.html');
    expect(files).not.toContain('sw.js');
  });

  it('keeps woff2 fonts and drops the old woff fallbacks', () => {
    expect(files).toContain('assets/font.woff2');
    expect(files).not.toContain('assets/font.woff');
  });
});

describe('cache version', () => {
  it('changes when a file changes, so players get the new build', () => {
    expect(cacheVersion(['a.js'], 'x')).not.toBe(cacheVersion(['b.js'], 'x'));
    expect(cacheVersion(['a.js'], 'x')).not.toBe(cacheVersion(['a.js'], 'y'));
    expect(cacheVersion(['a.js'], 'x')).toBe(cacheVersion(['a.js'], 'x'));
  });
});

describe('service worker', () => {
  const src = serviceWorker(BASE, ['', 'assets/a.js'], 'v1');

  it('is valid JavaScript', () => {
    expect(() => new Function(src)).not.toThrow();
  });

  it('stores every listed file under the base path, in a versioned cache', () => {
    expect(src).toContain(`const CACHE = 'mathlegends-v1'`);
    expect(src).toContain('"/Mathlegends/","/Mathlegends/assets/a.js"');
  });

  it('fetches pages from the network first (updates) and falls back to the stored page offline', () => {
    expect(src).toMatch(
      /req\.mode === 'navigate'[\s\S]*fetch\(req\)[\s\S]*catch\(\(\) => caches\.match\(BASE/,
    );
  });

  it('removes caches of older versions', () => {
    expect(src).toMatch(/k\.startsWith\('mathlegends-'\) && k !== CACHE[\s\S]*caches\.delete/);
  });
});
