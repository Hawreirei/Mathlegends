import { describe, expect, it } from 'vitest';
import id from '../src/data/i18n/id.json';
import en from '../src/data/i18n/en.json';
import { detectLang, t } from '../src/utils/i18n';

describe('i18n', () => {
  it('has the same keys in Indonesian and English, none empty', () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
    for (const v of [...Object.values(id), ...Object.values(en)]) expect(v.trim()).not.toBe('');
  });

  it('uses the same {placeholders} in both languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(id) as (keyof typeof id)[])
      expect(vars(id[k]), k).toEqual(vars(en[k]));
  });

  it('fills placeholders', () => {
    expect(t('en', 'result.time', { time: '8:32' })).toBe('Time: 8:32');
    expect(t('id', 'result.time', { time: '8:32' })).toBe('Waktu: 8:32');
  });

  it('detects English from the browser and falls back to Indonesian', () => {
    expect(detectLang('en-GB')).toBe('en');
    expect(detectLang('id-ID')).toBe('id');
    expect(detectLang('fr-FR')).toBe('id');
    expect(detectLang(undefined)).toBe('id');
  });
});
