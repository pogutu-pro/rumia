#!/usr/bin/env node
/**
 * Opens a real Chrome window on the local app, already signed in as a local test user (no Google needed).
 *
 *   node scripts/local-dev/open-signed-in.mjs [path] [email]
 *   node scripts/local-dev/open-signed-in.mjs /account shell-test@local.test
 *
 * Needs the local stack running (scripts/local-dev/up.sh) and AUTH_DEV_LOGIN=true in backend/.env.development.local.
 * Local only: it calls the backend's development-only /auth/dev-login endpoint, which refuses to work in production.
 */
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pnpm = join(root, 'web', 'node_modules', '.pnpm');
const dir = readdirSync(pnpm).find((d) => d.startsWith('playwright-core@'));
if (!dir) throw new Error('playwright-core not found: run `pnpm install` in web/');
const { chromium } = createRequire(import.meta.url)(join(pnpm, dir, 'node_modules', 'playwright-core'));

const path = process.argv[2] || '/';
const email = process.argv[3] || 'shell-test@local.test';
const WEB = process.env.WEB_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:8000/api/v1';

const res = await fetch(`${API}/auth/dev-login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, full_name: 'Paul Ogutu' }),
});
if (!res.ok) throw new Error(`dev-login failed (${res.status}). Is AUTH_DEV_LOGIN=true set and the backend running?`);
const t = await res.json();

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: false,
});
const ctx = await browser.newContext({ viewport: null });
const host = new URL(WEB).hostname;
await ctx.addCookies([
  { name: 'rumia_at', value: t.access_token, domain: host, path: '/' },
  { name: 'rumia_rt', value: t.refresh_token, domain: host, path: '/', httpOnly: true },
  { name: 'rumia_s', value: '1', domain: host, path: '/' },
]);
const page = await ctx.newPage();
await page.goto(WEB + path);
console.log(`Signed in as ${email}. Close the browser window to exit.`);
await new Promise((resolve) => browser.on('disconnected', resolve));
