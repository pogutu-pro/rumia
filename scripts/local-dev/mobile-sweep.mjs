#!/usr/bin/env node
/**
 * Mobile layout sweep (local only). For each route x width it records: horizontal overflow, fixed/sticky layers,
 * interactive targets under 44px, console errors, and a screenshot.
 *
 *   node scripts/local-dev/mobile-sweep.mjs [outDir] [--signed-in]
 *
 * Needs the local stack (scripts/local-dev/up.sh). Output: <outDir>/report.json, report.md and PNGs.
 */
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pnpm = join(root, 'web', 'node_modules', '.pnpm');
const req = createRequire(import.meta.url);
const pw = readdirSync(pnpm).find((d) => d.startsWith('playwright-core@'));
const { chromium } = req(join(pnpm, pw, 'node_modules', 'playwright-core'));
const axeDir = readdirSync(pnpm).find((d) => d.startsWith('axe-core@'));
const axeSrc = axeDir ? join(pnpm, axeDir, 'node_modules', 'axe-core', 'axe.min.js') : null;

const args = process.argv.slice(2);
const signedIn = args.includes('--signed-in');
const out = args.find((a) => !a.startsWith('--')) || join(process.cwd(), 'mobile-sweep');
mkdirSync(out, { recursive: true });
const WEB = process.env.WEB_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:8000/api/v1';

const ALL_WIDTHS = [
  [320, 640],
  [360, 780],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
];
const ALL_ROUTES = [
  '/',
  '/hostels',
  '/bnb',
  '/search?q=hostel',
  '/hostels/nyeri/near-gate-a/sunrise-hostel',
  '/videos',
  '/saved',
  '/compare',
  '/verify',
  '/agents',
  '/policy',
  '/terms',
  '/auth/login',
  '/account',
  '/account?tab=tours',
  '/account?tab=saved',
  '/account?tab=feedback',
  '/account?tab=settings',
  '/account/book-tour',
  '/dashboard',
  '/admin',
  '/manager',
];

// Narrow a run: ONLY_ROUTES=/,/videos ONLY_WIDTHS=390,320
const WIDTHS = process.env.ONLY_WIDTHS ? ALL_WIDTHS.filter(([w]) => process.env.ONLY_WIDTHS.split(',').includes(String(w))) : ALL_WIDTHS;
const ROUTES = process.env.ONLY_ROUTES ? process.env.ONLY_ROUTES.split(',') : ALL_ROUTES;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
let cookies = [];
if (signedIn) {
  const res = await fetch(`${API}/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'shell-test@local.test', full_name: 'Paul Ogutu' }),
  });
  if (!res.ok) throw new Error(`dev-login failed (${res.status})`);
  const t = await res.json();
  const domain = new URL(WEB).hostname;
  cookies = [
    { name: 'rumia_at', value: t.access_token, domain, path: '/' },
    { name: 'rumia_rt', value: t.refresh_token, domain, path: '/', httpOnly: true },
    { name: 'rumia_s', value: '1', domain, path: '/' },
  ];
}

const measure = () => {
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement;
  const rect = (el) => el.getBoundingClientRect();
  const label = (el) =>
    (el.getAttribute('aria-label') || el.textContent || el.getAttribute('href') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = rect(el);
      const cs = getComputedStyle(el);
      return r.width > 0 && r.right > vw + 1 && cs.position !== 'fixed' && !el.closest('[class*="overflow-x-auto"],[class*="overflow-x-scroll"],[class*="scrollbar-none"],[class*="snap-x"]');
    })
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(rect(el).right)} "${label(el)}"`);
  const fixed = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const p = getComputedStyle(el).position;
      const r = rect(el);
      return (p === 'fixed' || p === 'sticky') && r.width > 0 && r.height > 0;
    })
    .map((el) => {
      const r = rect(el);
      return `${getComputedStyle(el).position} ${el.tagName.toLowerCase()} "${label(el)}" top=${Math.round(r.top)} h=${Math.round(r.height)}`;
    })
    .slice(0, 12);
  const small = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab]')]
    .filter((el) => {
      const r = rect(el);
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('.sr-only') && (r.width < 44 || r.height < 44) && !(el.tagName === 'A' && el.closest('p,li,span') && r.height < 44 && el.textContent.trim().length > 30);
    })
    .slice(0, 400);
  const smallText = [...document.querySelectorAll('body *')].filter(
    (el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12,
  ).length;
  const bar = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed' && rect(n).bottom >= innerHeight - 1);
  return {
    vw,
    scrollWidth: doc.scrollWidth,
    overflow: doc.scrollWidth > vw + 1,
    wide,
    fixed,
    smallTargets: small.length,
    smallSample: small.slice(0, 6).map((el) => `${el.tagName.toLowerCase()} "${label(el)}" ${Math.round(rect(el).width)}x${Math.round(rect(el).height)}`),
    smallTextCount: smallText,
    hamburger: !!document.querySelector('[aria-label*="navigation menu" i]'),
    bottomBar: bar ? label(bar) : null,
    h1: document.querySelectorAll('h1').length,
  };
};

const results = [];
for (const [w, h] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 1024, isMobile: w < 768 });
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const errors = [];
    const onErr = (m) => m.type() === 'error' && errors.push(m.text().slice(0, 140));
    const onPage = (e) => errors.push('pageerror: ' + String(e).slice(0, 140));
    page.on('console', onErr);
    page.on('pageerror', onPage);
    const row = { route, width: w };
    try {
      const resp = await page.goto(WEB + route, { waitUntil: 'networkidle', timeout: 90000 });
      row.status = resp?.status();
      row.finalUrl = new URL(page.url()).pathname + new URL(page.url()).search;
      await page.waitForTimeout(400);
      Object.assign(row, await page.evaluate(measure));
      if (axeSrc && w === 390) {
        await page.addScriptTag({ path: axeSrc });
        row.axe = await page.evaluate(async () => (await window.axe.run({ runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => `${v.id}(${v.nodes.length})`));
      }
      const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
      await page.screenshot({ path: join(out, `${slug}-${w}.png`), fullPage: false });
    } catch (e) {
      row.error = String(e).slice(0, 160);
    }
    row.errors = [...new Set(errors)].slice(0, 4);
    page.off('console', onErr);
    page.off('pageerror', onPage);
    results.push(row);
    process.stdout.write(`${w} ${route} ${row.overflow ? 'OVERFLOW ' : ''}${row.error ? 'ERR' : ''}\n`);
  }
  await ctx.close();
}
await browser.close();

writeFileSync(join(out, 'report.json'), JSON.stringify(results, null, 2));
const md = ['| width | route | final | status | overflow | bar | burger | small targets | <12px text | console |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const r of results)
  md.push(
    `| ${r.width} | ${r.route} | ${r.finalUrl && r.finalUrl !== r.route ? r.finalUrl : ''} | ${r.status ?? r.error} | ${r.overflow ? `**${r.scrollWidth}>${r.vw}**` : ''} | ${r.bottomBar ?? ''} | ${r.hamburger ? 'yes' : ''} | ${r.smallTargets ?? ''} | ${r.smallTextCount ?? ''} | ${(r.errors || []).length} |`,
  );
writeFileSync(join(out, 'report.md'), md.join('\n'));
console.log(`\nWrote ${out}/report.md`);
