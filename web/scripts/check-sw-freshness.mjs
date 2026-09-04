#!/usr/bin/env node
/**
 * scripts/check-sw-freshness.mjs
 *
 * Verifies that public/sw.js is newer than src/app/sw.ts.
 * Run after `next build` to catch stale service-worker drift before deployment.
 *
 * Usage: node scripts/check-sw-freshness.mjs
 */

import { statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src  = resolve(root, 'src/app/sw.ts');
const dest = resolve(root, 'public/sw.js');

let srcMtime, destMtime;

try {
  srcMtime  = statSync(src).mtimeMs;
} catch {
  console.error(`check-sw-freshness: cannot stat ${src}`);
  process.exit(1);
}

try {
  destMtime = statSync(dest).mtimeMs;
} catch {
  console.error(`check-sw-freshness: public/sw.js does not exist — run 'pnpm build' first.`);
  process.exit(1);
}

if (destMtime < srcMtime) {
  console.error(
    `check-sw-freshness: public/sw.js is older than src/app/sw.ts.\n` +
    `  sw.ts  mtime: ${new Date(srcMtime).toISOString()}\n` +
    `  sw.js  mtime: ${new Date(destMtime).toISOString()}\n` +
    `Run 'pnpm build' to regenerate public/sw.js before deploying.`,
  );
  process.exit(1);
}

console.log('check-sw-freshness: public/sw.js is up to date.');
