/**
 * Saves text as a file in the browser (#30). Uses a temporary link with the `download`
 * attribute, which works in desktop browsers, Android Chrome and iOS Safari 13+.
 * Not unit-tested (needs a browser); checked with Playwright on desktop and phone viewports.
 */
export function downloadText(fileName: string, text: string, mime = 'text/csv'): void {
  // The byte-order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before the URL is freed.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
