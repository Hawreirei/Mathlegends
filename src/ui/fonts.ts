/**
 * Self-hosted fonts (#14): bundled from @fontsource (SIL Open Font License 1.1), latin subset only,
 * so the game makes no request to Google Fonts and works offline.
 */
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import theme from '../data/theme.json';

/** Phaser draws text on a canvas, so the fonts must be loaded before the first scene renders. */
export async function loadFonts(): Promise<void> {
  const { display, body } = theme.fonts;
  await Promise.all(
    [
      `700 32px "${display}"`,
      `600 32px "${display}"`,
      `700 16px "${body}"`,
      `800 16px "${body}"`,
    ].map((f) => document.fonts.load(f).catch(() => [])),
  );
}
