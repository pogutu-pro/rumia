# 09 · Media and Content Strategy

Covers: media pipeline, video, the shareable property page as a distribution loop.

---

## 1. The thesis, and how to test it

**Thesis (from the brief).** Owners already make photos and videos for TikTok, Instagram and WhatsApp. If each property has a strong Rumia page, owners will share Rumia links, and people who arrive for one property will discover others.

**[OBS]** Plausible, and the best growth idea in the brief, because it gets distribution from supply instead of paid acquisition. It is also untested. Two things must be true:

1. Owners prefer sharing a Rumia link over posting media directly. They will if the link does something their post can't: always-current availability and price, all units in one place, a verified badge, and inquiries arriving pre-qualified with a reference code.
2. Visitors arriving on one property go on to view others. Measure: properties viewed per shared-link session, and share-landing → contact on a different property.

**[REC]** Ship the share kit early (Phase 2) and measure both before investing in a video-first home.

---

## 2. Photos

**[FACT]** Images go browser → Next API route → `sharp` in the Next process → R2 variants + blur placeholder → registered with the API. Variants and blur are good. Processing location is not.

**[REC]**

- **Direct upload**: client requests a presigned PUT URL from the API (`media.create_upload`), compresses on device (max ~2,000 px long edge, WebP/JPEG ~80%), uploads straight to R2 `raw/`, then calls `media.complete`.
- **Worker processing**: generates AVIF + WebP variants (thumb 320, card 640, detail 1280, full 2048), blur placeholder, perceptual hash (for duplicate/fraud detection across listings), strips EXIF from public variants, stores EXIF GPS privately as verification evidence.
- **Serving**: R2 behind a Cloudflare custom domain (not `r2.dev`, which is rate-limited and not meant for production) with long cache headers; `srcset` by variant.
- **Guidance in the editor**: suggested shots (exterior, room, bathroom, kitchen, view from window), a cover chooser, warnings for very dark or very small images. Room tags make the gallery navigable ("Bathroom (2)").
- **Minimum to publish**: 3 photos including one of a room. More improves `quality_score`, which affects ranking, so the incentive is visible ("Add a bathroom photo to rank higher").

---

## 3. Video

**[FACT]** One `youtube_id` per listing. Rumia can't see who watched, for how long, can't control quality on mobile data, and YouTube's player suggests other channels' videos at the end.

**[REC]**

| Decision | Reasoning | Trade-off |
|---|---|---|
| **Native vertical video via Cloudflare Stream** (or Mux; Stream fits the existing Cloudflare/R2 setup) | Adaptive bitrate (HLS) matters on Kenyan mobile networks; watch analytics; no exits to YouTube; poster frames; direct upload from phone | Cost per minute stored and delivered. Cap videos at 90 s and a few per property; budget it against usage |
| **Accept the clip owners already have** | They already shot it for TikTok/WhatsApp; ask them to upload the file, not re-shoot | Watermarked TikTok exports look second-hand; acceptable at first |
| **Keep external links (YouTube, TikTok) as a fallback** | Existing listings have YouTube ids; some owners only have links | No analytics for those; rank native video slightly higher via quality score |
| **Data-respectful playback** | Poster image by default; tap to play on cellular or `Save-Data`; autoplay muted only on Wi-Fi in Watch mode | Lower passive engagement; correct for users paying per MB |
| **Moderation** | First video from a new org is reviewed with the listing | Review time |

**Watch mode** (inside Discover): vertical, one property per screen, swipe to next, overlay with price, place and trust line, actions (save, share, WhatsApp). Ranked by Stage 1 + video completion. Only properties with native or embeddable vertical video.

---

## 4. The property page as a distribution asset

| Element | Purpose |
|---|---|
| **Short canonical link** `rumia.co.ke/p/kamakwa-heights-7k2` | Fits in bios and captions; stable |
| **Open Graph image** generated per property: cover photo, price per period, neighbourhood, "Available, confirmed {date}" | The WhatsApp link preview does the selling before the tap. `/api/og` exists today; extend it |
| **Share kit in the lister workspace** | "Your Rumia link" with copy button, pre-written captions for WhatsApp Status/Instagram/TikTok, QR code for a gate sign (QR library already in the codebase), a status-sized image |
| **Org profile page** `/l/{slug}` | All of an owner's or agent's properties, for their bio link |
| **"More nearby" below the fold** | Converts a single-property visit into discovery |
| **Attribution** | `?s={share_id}` on shared links, generated per share action, so arrivals are attributed to the property and channel without personal data |
| **Graceful let/paused state** | A shared link never dies; it shows status and alternatives |

---

## 5. Content Rumia writes

- **Neighbourhood pages** (Kamakwa, Ruringu, Skuta, Mathari, Gatitu, etc.: whichever the market uses): typical prices by unit kind, walking times to landmarks, what it's like, live listings. These are the SEO surface and answer what newcomers to Nyeri don't know.
- **Landmark pages** ("Places to rent near DeKUT"): the student entry point, without making the whole product about one campus.
- **Guides** only where they answer real questions (deposits, what to check on a viewing, avoiding rental scams). Short, few, maintained.

---

## 6. Rights and moderation

- Lister terms state they own or have permission for uploaded media and grant Rumia a licence to display it, including in Rumia's marketing.
- Perceptual hashes catch the same photos used on multiple properties (a common scam pattern) → queue item.
- Faces and personal items: guidance to avoid; reviewers can blur or reject.
