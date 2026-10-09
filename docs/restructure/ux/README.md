# Rumia Public Web Experience: UX Redesign Plan

Status: **proposal for review. No application code was changed.**
Date: 2026-10-08. Part of the restructuring package in `docs/restructure/`; this folder goes deeper on the public web experience and supersedes `../05-experience.md` §1–2 and §7 where they differ.

## Read in this order

| File | Deliverables |
|---|---|
| [07-decisions-and-sequence.md](07-decisions-and-sequence.md) | **Start here**: the final answer (§4), before vs after (12), rebuild decisions (13), sequence (14) |
| [01-ux-audit.md](01-ux-audit.md) | Current UX audit (1), user journey audit (2) |
| [02-research.md](02-research.md) | Research and how it applies, incl. the Airbnb benchmark (3) |
| [03-principles-and-ia.md](03-principles-and-ia.md) | Principles (4), information architecture (5), screen inventory (6) |
| [04-screen-specs.md](04-screen-specs.md) | Detailed experience specification per screen (7) |
| [05-design-system.md](05-design-system.md) | Design system direction (8), responsive strategy (9), performance UX (10) |
| [06-personalization-web.md](06-personalization-web.md) | Rumia Brain and web personalization by visitor stage (11) |

## The decisions in brief

1. **Rebuild the public UI** on the existing Next.js stack. The current structure is DeKUT hostels plus a separate BnB product, and its core action is blocked in the main channel.
2. **Three screens matter: Explore, Property, Saved.** Home and search become one Explore screen. Short stays become a mode, not a product.
3. **Contact is one tap to WhatsApp**, no account, with a reference code for attribution.
4. **Trust is shown as dated facts**, not badges. The location map comes back.
5. **Rumia Brain** = Intent → Context → Preferences → Ranking → Recommendations → Alerts. It starts with remembering on the device, with no account required, and its most valuable output is the alert.
6. **Fix the live problems now** (`07` §3, Step 0: nine items), including: no Contact button at tablet widths, an invented "Security Available" claim, stock-photo fallbacks, and card prices that don't match the property page.
7. **Design in Claude Design, test with 6–8 people in Nyeri on their own phones from a WhatsApp link**, then build the property page first.

## Limits of this audit

Done from code and fetched live HTML. Visual layout, real-device performance and assistive-technology behaviour still need checking in a browser (`01` §6). With the Chrome extension connected (`/chrome`), that pass can be done next.
