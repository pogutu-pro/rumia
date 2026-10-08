# UX 05 · Design System, Responsive Strategy and Performance UX

Covers deliverables 8 (design system direction), 9 (responsive strategy) and 10 (performance UX strategy).

---

## 1. Visual direction

**Character: a well-kept noticeboard, not a showroom.** Calm, factual, warm and local. Photography carries emotion; the interface carries facts. "Premium" comes from precise alignment, good type, restraint, and fast response, not from effects.

What makes it distinctly Rumia (rather than a generic marketplace):

- **Facts set as quiet sentences**, not badges. "Confirmed by the owner 2 days ago" in small regular text with a single small icon is Rumia's signature, repeated everywhere.
- **Price typography**: large, tabular, with the period always attached ("KSh 7,500 / month"). Prices are the most designed text on the page.
- **A single warm green accent** used only for actions and confirmed facts, on warm off-white surfaces. Rooted in the current brand colour, deepened so it reads as considered rather than the default Tailwind emerald.
- **Place-first language**: walk times and area names everywhere.

### Explicitly not

Gradients on surfaces, glassmorphism, oversized hero type, uppercase micro-labels, coloured pills for every attribute, multiple accent colours, decorative illustration, confetti, spring-bounce modals, `font-black` everywhere.

---

## 2. Tokens

All values are CSS variables consumed by Tailwind (`@theme`). Components use only semantic tokens; raw palette classes (`slate-400`, `gray-500`, `emerald-600`) are banned by lint in new code.

### 2.1 Colour (light; dark mirrors with the same names)

| Token | Role | Starting value (to tune in Claude Design) |
|---|---|---|
| `--surface` | Page background | warm off-white `#FAF9F7` |
| `--surface-raised` | Cards, sheets, sticky bars | `#FFFFFF` |
| `--surface-sunken` | Inputs, placeholders | `#F2F0EC` |
| `--border` | Hairlines | `#E6E2DC` |
| `--text` | Primary text | `#1C1B19` |
| `--text-muted` | Secondary text (must meet 4.5:1 on `--surface`) | `#5F5A53` |
| `--accent` | Primary buttons, links, selected states | deep green `#1F6B4F` |
| `--accent-contrast` | Text on accent | `#FFFFFF` |
| `--positive` | Confirmed/available facts | same family as accent, `#2E7D5B` |
| `--caution` | Stale, "ask before you visit" | amber-brown `#8A5A12` |
| `--danger` | Destructive, removed, report | `#B3261E` |
| `--focus` | Focus ring | `#1F6B4F` at 2 px + 2 px offset |

Rules: one accent. Status colour is always paired with words. Never colour alone.

### 2.2 Typography

- **One typeface family**, variable, with tabular figures and good small-size legibility. Evaluate 2–3 candidates in Claude Design with real content (prices, Kenyan place names, long hostel names): Inter (current, safe), Geist, and one humanist sans with more character. Drop the second family (Plus Jakarta Sans).
- Weights: 400, 500, 600. No 800/900.
- Scale (px, mobile → desktop where different):

| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Minimum size anywhere. Captions, map labels |
| `text-sm` | 14 / 20 | Card secondary lines, facts, metadata |
| `text-base` | 16 / 24 | Body, inputs (16 px avoids iOS zoom) |
| `text-lg` | 18 / 26 | Card price, section labels |
| `text-xl` | 22 / 28 | Section headings |
| `text-2xl` | 26 → 30 / 34 | Property name |
| `text-price` | 28 → 32 / 36, tabular, 600 | Property page price |

Nothing below 12 px (today: 101 uses of 9–11 px).

### 2.3 Space, grid, shape, depth

- **Spacing:** 4 px base; use 4, 8, 12, 16, 24, 32, 48, 64.
- **Grid:** 4 columns S (16 px gutters, 16 px margins), 8 columns M (24 px margins), 12 columns L/XL (32 px margins); content max-width 1,280 px (property page), 1,600 px (Explore split view).
- **Radius:** two values only. `--radius-control` 10 px (buttons, inputs, sheets' top corners), `--radius-media` 14 px (images, cards). Fully round only for the save button and avatar.
- **Borders:** 1 px `--border` hairlines to separate sections; cards have no border (the image defines them).
- **Elevation:** one shadow, used only for things that float (sticky action bar, sheets, map popovers, menus): `0 4px 16px rgb(0 0 0 / 0.08)`. Nothing else has a shadow.

### 2.4 Iconography

Lucide only, 20 px default, 1.75 stroke, `currentColor`. Icons accompany text; they don't replace it except for universally understood actions (heart, share, close, back, play) which always have accessible names. Remove heroicons and react-icons.

### 2.5 Components (owned by Rumia, built on shadcn/Radix)

| Component | Notes |
|---|---|
| Button | Primary (accent fill), Secondary (surface + border), Text. Heights 48 (S) / 44 (L). One primary per view |
| WhatsAppButton | Primary button with WhatsApp glyph in the accent colour, not WhatsApp's green (one accent rule) |
| SearchBox | Suggestions list (areas, landmarks, places), parsed chips, clear button |
| ModeSwitch | Two-option segmented control |
| FilterButton + FilterSheet / FilterPopover | Sheet on S/M with live-count Apply; popover on L |
| PropertyCard | Grid, compact and map-popover variants (§UX 04-5) |
| PriceBlock | Price, period, move-in, included |
| FactLine | Icon + sentence + optional explanation popover |
| MediaViewer | Gallery, room tags, full-screen, video poster, keyboard support |
| UnitTable | Selectable rows |
| StaticMap → InteractiveMap | Image first; map library loaded on interaction |
| ActionBar | Sticky mobile actions; same component renders the desktop sticky card |
| Sheet, Dialog, Toast (with Undo), InlineNotice, EmptyState, ErrorState | |

### 2.6 Photography and video treatment

- 4:3 for cards and the lead image; full-screen viewer respects native aspect ratio.
- No overlays, gradients or text on photos, except the small video duration badge and the heart button (on a solid white circle for contrast).
- Video: poster frame with a centred play button; plays inline on tap with sound; captions toggle; no autoplay except muted on Wi-Fi in a future Watch mode.
- Guidance to listers favours daylight interior shots; a soft brightness check in the editor.

### 2.7 Motion

- Durations 120 ms (state), 200 ms (enter), 160 ms (exit); ease-out. No springs.
- Motion only for: sheets/dialogs opening, image viewer transitions, the save heart (a single fill), and progress.
- `prefers-reduced-motion`: crossfades only.
- Drop framer-motion from public pages; CSS transitions cover all of the above.

---

## 3. Responsive strategy

One product, one component set, with interaction changing at the points where input and space change:

| Concern | S (< 640) | M (640–1023) | L (1024–1439) | XL (≥ 1440) |
|---|---|---|---|---|
| Explore results | 1 column | 2 columns | Split: 2 cols + map | Split: 3 cols + map |
| Map | Full-screen toggle | Full-screen toggle | Always visible | Always visible |
| Filters | Row of buttons → bottom sheets | Same | Popovers under each button | Same |
| Property media | Swipe carousel | Swipe carousel | Mosaic + "Show all" | Mosaic |
| Property actions | Sticky bottom bar | Sticky bottom bar | Sticky side card | Sticky side card |
| Contact | WhatsApp app | WhatsApp app | WhatsApp Web + QR fallback | Same |
| Hover | None | None (touch) | Card hover highlights map pin; prefetch on hover | Same |
| Keyboard | — | External keyboards supported | Full keyboard paths, `/` focuses search | Same |

Rules:

- **Exactly one breakpoint** (1024 px) switches the property page between action bar and side card, from one component. Prevents B1.
- Touch targets ≥ 44 px at every size; S/M primary buttons 48 px.
- Test matrix: 360×780 (common Android), 412×915, 768×1024 (portrait tablet), 1024×768, 1366×768 (common laptop), 1920×1080.

---

## 4. Performance UX strategy

### 4.1 Budgets (mid-range Android, 4G, p75)

| Page | LCP | INP | CLS | JS (compressed) | Page weight first view |
|---|---|---|---|---|---|
| Property | < 2.0 s | < 200 ms | < 0.05 | ≤ 120 KB | ≤ 450 KB |
| Explore | < 2.5 s | < 200 ms | < 0.05 | ≤ 150 KB (map loads separately on L or on demand) | ≤ 600 KB |
| Saved | < 2.0 s | < 200 ms | < 0.05 | ≤ 100 KB | ≤ 300 KB |

Enforced in CI with Lighthouse CI on throttled profiles and tracked in production with web-vitals → PostHog/Sentry.

### 4.2 How it should feel

| Situation | Behaviour |
|---|---|
| Normal 4G | Pages appear complete on first paint (SSR). Navigations feel instant because cards prefetch the property route when they enter the viewport (S/M) or on hover (L) |
| Slow 3G / congested | HTML and text arrive first; images fill in from blur placeholders without layout shift; no spinners over blank screens; the action bar is usable before images finish |
| `Save-Data` or 2G | Smallest image variants, no map image until tapped, video posters only |
| Offline | Saved and recently viewed property pages open from the service-worker cache with "Offline, details from {time}"; save/unsave queue and sync later; Explore shows the last results with a banner |
| Request fails | Keep what's on screen; inline retry; never wipe the user's state |
| Flaky contact logging | WhatsApp opens regardless; the inquiry event retries via `sendBeacon`/queue |

### 4.3 Techniques

- Server Components and ISR for Explore's first page, property, place and landmark pages, cached at Cloudflare.
- Image variants by width (320/640/1280) in AVIF with WebP fallback; `fetchpriority="high"` on the LCP image only; everything else lazy.
- Static map image first (generated server-side and cached), interactive map library loaded on interaction or on L.
- Optimistic UI for save, unsave, filter changes (dim previous results rather than clearing).
- Route-level prefetch of `/p/*` from visible cards; no prefetch on `Save-Data`.
- Fonts: one variable font, subset, `font-display: swap`, size-adjusted fallback (already partly configured).
- Remove from public bundles: framer-motion, three.js, chart libraries, Fuse.js, axios, Supabase packages.

### 4.4 Accessibility as part of performance and design

Covered in each screen spec; system-wide commitments:

- WCAG 2.2 AA. Automated axe checks in CI on Explore, Property and Saved; manual TalkBack pass per release touching these pages.
- Visible focus on every interactive element (`--focus` ring); logical tab order; skip link to results/content.
- Forms: labels always visible, errors next to the field in words, never colour alone; inputs 16 px.
- Images: meaningful alt text generated from room tags; decorative images empty alt.
- Video: captions when speech exists; no autoplay; pause control.
- Language attribute set; content written at a plain reading level; prepared for Swahili later.
