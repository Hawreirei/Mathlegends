/**
 * After a deploy (#53): waits until the live site serves the expected commit, by reading its
 * version.json (never cached by the service worker). Fails after 10 minutes.
 *
 *   node scripts/wait-live.ts https://hawreirei.github.io/Mathlegends/ <commit sha>
 */
const [url, commit] = process.argv.slice(2);
if (!url || !commit) {
  console.error('usage: node scripts/wait-live.ts <site url> <commit sha>');
  process.exit(2);
}

const deadline = Date.now() + 10 * 60 * 1000;
let last = '';
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${url.replace(/\/?$/, '/')}version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const v = (await res.json()) as { version: string; commit: string };
      last = `v${v.version} @ ${v.commit}`;
      if (v.commit === commit) {
        console.log(`Live: ${last}`);
        process.exit(0);
      }
    } else last = `HTTP ${res.status}`;
  } catch (e) {
    last = String(e);
  }
  console.log(`Waiting for ${commit.slice(0, 7)}; live is ${last}`);
  await new Promise((r) => setTimeout(r, 15_000));
}
console.error(`The live site never served ${commit}; last seen: ${last}`);
process.exit(1);

export {};
