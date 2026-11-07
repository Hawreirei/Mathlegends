/** Release notes and the version (#52). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { notesFor } from '../scripts/release-notes';

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

describe('release notes', () => {
  it('takes one version section, up to the next one', () => {
    const md = '# Changelog\n\n## [0.2.0] - x\nnew\n\n## [0.1.0] - y\nfirst\n';
    expect(notesFor(md, '0.2.0')).toBe('new');
    expect(notesFor(md, '0.1.0')).toBe('first');
    expect(notesFor(md, '9.9.9')).toBeNull();
  });

  it('CHANGELOG.md has a section for the version in package.json, with known issues', () => {
    const notes = notesFor(changelog, pkg.version);
    expect(notes, `## [${pkg.version}] in CHANGELOG.md`).not.toBeNull();
    expect(notes).toMatch(/### Known issues/);
  });

  it('the version is semantic (x.y.z)', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
