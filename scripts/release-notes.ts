/**
 * Release notes for one version (#52): the `## [x.y.z]` section of CHANGELOG.md, used by
 * .github/workflows/release.yml for the GitHub Release text.
 *
 *   node scripts/release-notes.ts 0.1.0 > notes.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The body of `## [version]` up to the next `## [`, trimmed; null if there is none. */
export function notesFor(changelog: string, version: string): string | null {
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## ['));
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const version = process.argv[2];
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const notes = version ? notesFor(changelog, version) : null;
  if (!notes) {
    console.error(`CHANGELOG.md has no section "## [${version}]"`);
    process.exit(1);
  }
  console.log(notes);
}
