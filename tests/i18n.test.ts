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

describe('question text in the chosen language (#23)', () => {
  it('picks the stem/explanation language', async () => {
    const { localize } = await import('../src/utils/i18n');
    expect(localize({ id: 'Berapa 2 + 2?', en: 'What is 2 + 2?' }, 'id')).toBe('Berapa 2 + 2?');
    expect(localize({ id: 'Berapa 2 + 2?', en: 'What is 2 + 2?' }, 'en')).toBe('What is 2 + 2?');
  });

  it('shows choices: numbers and neutral strings as-is, localized text in the chosen language', async () => {
    const { choiceText } = await import('../src/utils/i18n');
    expect(choiceText(42, 'id')).toBe('42');
    expect(choiceText('3/4', 'en')).toBe('3/4');
    expect(choiceText({ id: '0,5', en: '0.5' }, 'id')).toBe('0,5');
    expect(choiceText({ id: 'Rp2.500', en: 'Rp2,500' }, 'en')).toBe('Rp2,500');
  });
});

describe('language preference (#23)', () => {
  const fakeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      m,
    };
  };

  it('saves and loads the chosen language', async () => {
    const { loadLang, saveLang } = await import('../src/utils/storage');
    const s = fakeStorage();
    expect(loadLang(s)).toBeNull();
    saveLang(s, 'en');
    expect(loadLang(s)).toBe('en');
  });

  it('ignores bad saved values and a storage that throws (private mode)', async () => {
    const { loadLang, saveLang } = await import('../src/utils/storage');
    const s = fakeStorage();
    s.setItem('mathlegends.lang', 'fr');
    expect(loadLang(s)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadLang(broken)).toBeNull();
    expect(() => saveLang(broken, 'id')).not.toThrow();
  });

  it('starts in the saved language, else the browser language, else Indonesian', async () => {
    const { initialLang } = await import('../src/utils/storage');
    const s = fakeStorage();
    expect(initialLang(s, 'en-US')).toBe('en');
    expect(initialLang(s, 'de-DE')).toBe('id');
    s.setItem('mathlegends.lang', 'id');
    expect(initialLang(s, 'en-US')).toBe('id');
  });

  it('setLang changes only the language in the game state', async () => {
    const { createGameState, setLang } = await import('../src/systems/gameState');
    const s = createGameState('id');
    const n = setLang(s, 'en');
    expect(n.lang).toBe('en');
    expect(n.profile).toBe(s.profile);
    expect(s.lang).toBe('id');
  });
});

describe('no inline player-facing text (AGENTS.md rule 6a)', () => {
  const files = import.meta.glob<string>(
    ['../src/scenes/*.ts', '../src/ui/*.ts', '../src/entities/*.ts'],
    {
      eager: true,
      query: '?raw',
      import: 'default',
    },
  );
  // Brand name and language codes are the same in both languages.
  const ALLOWED = new Set(['MATH', 'LEGENDS', 'ID', 'EN', '0:00']);

  it('passes only translated strings (tr/t) to text objects and buttons', () => {
    const problems: string[] = [];
    for (const [file, src] of Object.entries(files)) {
      const calls = [
        ...src.matchAll(/\.text\(\s*[^,]+,\s*[^,]+,\s*(['"`])([^'"`]*)\1/g),
        ...src.matchAll(/new Button\(\s*this,\s*[^,]+,\s*[^,]+,\s*(['"`])([^'"`]*)\1/g),
      ];
      for (const m of calls) {
        // Ignore ${...} expressions inside template strings; only the literal text counts.
        const literal = (m[2] ?? '').replace(/\$\{[^}]*\}/g, '');
        if (/[A-Za-z]{2,}/.test(literal) && !ALLOWED.has(literal))
          problems.push(`${file}: "${literal}"`);
      }
    }
    expect(problems).toEqual([]);
  });
});
