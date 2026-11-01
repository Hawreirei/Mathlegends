/** Rank text in the chosen language (#42): "Year 3 · 1 star", "Kelas 6 · 9 bintang". */
import ranksJson from '../data/ranks.json';
import type { Lang } from '../systems/gameState';
import { t } from '../utils/i18n';

export const yearLabel = (lang: Lang, tier: number): string =>
  (ranksJson.tiers.find((k) => k.tier === tier) ?? ranksJson.tiers[0]!).label[lang];

/** "1 star" / "3 stars" (Indonesian has no plural: "1 bintang", "3 bintang"). */
export const starsText = (lang: Lang, n: number): string =>
  t(lang, n === 1 ? 'rank.starsOne' : 'rank.starsMany', { n });

export const rankLabel = (lang: Lang, tier: number, stars: number): string =>
  t(lang, 'menu.rank', { year: yearLabel(lang, tier), stars: starsText(lang, stars) });
