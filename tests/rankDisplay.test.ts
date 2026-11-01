import { describe, expect, it } from 'vitest';
import ranksJson from '../src/data/ranks.json';
import theme from '../src/data/theme.json';
import { readTheme, renderSprites } from '../scripts/build-sprites';
import { loadRanks } from '../src/systems/data';
import { rankView, starChanges, starPoints } from '../src/systems/rankDisplay';
import { rankLabel, starsText } from '../src/ui/rankText';

const ranks = loadRanks(ranksJson);

describe('rank badge contents (#42)', () => {
  it('below Year 6: filled icons up to the stars, progress to the next Year', () => {
    expect(rankView(3, 2, ranks)).toEqual({
      tier: 3,
      total: 2,
      filled: 2,
      icons: 5,
      times: null,
      toNext: 3,
      nextTier: 4,
      progress: 0.4,
    });
    expect(rankView(1, 0, ranks)).toMatchObject({ filled: 0, toNext: 5, progress: 0 });
  });

  it('Year 6 with more than 5 stars: 5 filled icons plus ×N with the real total', () => {
    expect(rankView(6, 9, ranks)).toMatchObject({
      filled: 5,
      icons: 5,
      times: 9,
      toNext: null,
      nextTier: null,
      progress: 1,
    });
    expect(rankView(6, 23, ranks)).toMatchObject({ filled: 5, times: 23 });
    expect(rankView(6, 6, ranks).times).toBe(6);
    expect(rankView(6, 5, ranks).times).toBeNull();
    expect(rankView(6, 3, ranks)).toMatchObject({ filled: 3, times: null });
  });

  it('the text reads "Kelas 6 · 9 bintang" / "Year 6 · 9 stars", with "1 star" in English', () => {
    expect(rankLabel('id', 6, 9)).toBe('Kelas 6 · 9 bintang');
    expect(rankLabel('en', 6, 9)).toBe('Year 6 · 9 stars');
    expect(rankLabel('en', 3, 1)).toBe('Year 3 · 1 star');
    expect(rankLabel('id', 3, 1)).toBe('Kelas 3 · 1 bintang');
    expect(starsText('en', 0)).toBe('0 stars');
  });

  it('star icons are 5-pointed shapes, first point straight up', () => {
    const p = starPoints(10, 10, 8, 4);
    expect(p).toHaveLength(10);
    expect(p[0]!.x).toBeCloseTo(10);
    expect(p[0]!.y).toBeCloseTo(2);
  });
});

describe('star animation after a match (#42)', () => {
  const at = (tier: number, stars: number) => ({ tier, stars });
  it('new stars pop in', () => {
    expect(starChanges(at(2, 1), at(2, 3), ranks)).toEqual({ gained: [1, 2], lost: [] });
  });
  it('on a promotion the carried-over stars of the new Year pop in', () => {
    expect(starChanges(at(2, 4), at(3, 1), ranks)).toEqual({ gained: [0], lost: [] });
    expect(starChanges(at(2, 4), at(3, 0), ranks)).toEqual({ gained: [], lost: [] });
  });
  it('a lost star fades out; a demotion animates no stars', () => {
    expect(starChanges(at(3, 2), at(3, 1), ranks)).toEqual({ gained: [], lost: [1] });
    expect(starChanges(at(3, 0), at(2, 3), ranks)).toEqual({ gained: [], lost: [] });
  });
  it('Year 6 above 5 stars has no icon to animate (the ×N pulses instead)', () => {
    expect(starChanges(at(6, 8), at(6, 10), ranks)).toEqual({ gained: [], lost: [] });
    expect(starChanges(at(6, 4), at(6, 6), ranks)).toEqual({ gained: [4], lost: [] });
  });
});

describe('badges are distinguishable without colour (#42)', () => {
  const sprites = renderSprites(readTheme());
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };

  it('each Year shows its own number and that many sparkles', () => {
    for (let tier = 1; tier <= 6; tier++) {
      const svg = sprites.get(`badge-year-${tier}`)!;
      expect(svg).toContain(`>${tier}</text>`);
      const sparkles = (svg.match(/<path/g) ?? []).length - 2; // minus the two shield shapes
      expect(sparkles, `Year ${tier}`).toBe(tier);
    }
  });

  it('fills get darker Year by Year, so they differ in lightness too', () => {
    const fills = theme.badges.fills;
    expect(fills).toHaveLength(6);
    for (let i = 1; i < fills.length; i++)
      expect(lum(fills[i]!), `Year ${i + 1} darker than Year ${i}`).toBeLessThan(
        lum(fills[i - 1]!),
      );
  });
});
