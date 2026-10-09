# UX 02 · Research and What It Means for Rumia

Covers deliverable 3. Each finding ends in a Rumia decision. Sources are listed at the end; where a source is a secondary summary rather than primary research, it's marked as such and weighted accordingly.

---

## 1. Context: who uses Rumia and on what

| Finding | Source | Rumia decision |
|---|---|---|
| Android is ~92–94% of smartphones in Kenya; budget phones from ~KSh 3,000 | Business Daily; Statcounter | Design and test for mid/low-end Android Chrome first. JS budget is a UX feature |
| Mobile data averaged ~KSh 95/GB in 2025, and common bundles are small (hourly/daily) | Business Daily; TechCabal | Every MB costs the user. No autoplay video, no 1,000-listing payloads, image variants sized to the screen |
| WhatsApp is among the most used platforms in Kenya; TikTok and Facebook usage growing | Communications Authority data via Capital FM; Statista | Shared links open in WhatsApp/Instagram/TikTok/Facebook in-app browsers. The property page must work fully there |
| Google blocks OAuth in embedded webviews (`disallowed_useragent`) | Google Developers Blog; Auth0 | Never put sign-in in the path of browse, save or contact |
| Rental scams are common: fake landlords take M-Pesa deposits for rooms that don't exist, impersonation, unauthorised subletting; students in their first year are explicitly targeted; urgency ("someone else wants it") is the classic tactic | Citizen Digital; Kenyans.co.ke; McTaba campus guide (secondary) | Trust is the product. Show evidence, not badges. Include a plain "Never pay before you view" safety note. Never use fake urgency ourselves |

## 2. Search, filtering and results

| Finding | Source | Rumia decision |
|---|---|---|
| On accommodation sites, **location is the most important factor** in judging relevance; users need to see where a place is relative to what they'll do | Baymard, travel accommodations research | Show location on every card (place + walk time to the user's anchor) and on the property page with a map. Restore the hidden location section |
| In testing, **95% of users engaged with the map in a split view vs 35% when the map sat behind a "Map view" link**; users struggled to find map links and lost map changes when switching views | Baymard, split view study | Desktop results: list + map side by side by default. Mobile: one tap to the map, and map/list share the same state |
| 34% of sites have poor filtering; 61% don't promote important filters; 62% don't explain industry-specific filters | Baymard filtering benchmark | Show 3–4 high-value filters directly (Area, Price, Type), the rest in a sheet; explain local terms (bedsitter, self-contained) in one line |
| Filters must be specific to the category being viewed; most general filters first | NN/g (via Algolia summary, secondary) | Filters change with stay type and property type: hostels get sharing/gender policy; apartments get bedrooms/parking; nightly stays get guests/dates |
| Mobile filter best practice: one Filter button, full-screen or bottom sheet, large targets, an Apply button showing the result count | Industry summary of NN/g and Baymard guidance (secondary) | "Show 23 places" on the apply button; counts update live |
| Infinite scroll suits open-ended browsing but hurts goal-directed finding; "Load more" keeps rhythm with an explicit stopping point | NN/g | Results use "Show more" with a visible count, not infinite scroll. Footer stays reachable |
| Airbnb's "flexible matching" shows a few options slightly outside the user's price | Airbnb product release (press) | When results are few, show a clearly labelled "Just above your budget" group instead of an empty page |

## 3. Listing cards and property pages

| Finding | Source | Rumia decision |
|---|---|---|
| Photos, floorplans, summary and price are what drive enquiries; listings with more than 5 photos perform better; renters respond to interior images | Rightmove property marketing reports (industry research) | Cover photo should be an interior/room shot for rentals. Require 3 photos to publish, nudge to 6+. Room-tagged gallery |
| Airbnb moved to showing **total price up front** in search, and ranks by total price, after guest complaints about hidden fees | Airbnb releases via Skift/Fox (press) | Rumia's equivalent is **move-in cost** (rent + deposit) and "what's included". Show it on the page; offer it as a card toggle later |
| Location context in search results is decision-critical | Baymard | Card line 2: "Kamakwa · 8 min walk to DeKUT" (anchor-relative when the user has one) |

## 4. Personalization on the web

| Finding | Source | Rumia decision |
|---|---|---|
| Most returning visitors are not logged in; recognising the device lets a site resume where the user left off without sign-in | Adobe Experience League; industry articles (secondary) | Remember last search and recently viewed on the device (first-party storage). "Continue where you left off" is the first personalised feature |
| Recently viewed sections help returning visitors resume | A/B test write-ups (secondary, vendor) | "Recently viewed" on home for returning visitors; capped, clearable |

## 5. Performance perception

| Finding | Source | Rumia decision |
|---|---|---|
| 53% of mobile visits are abandoned if a page takes more than 3 seconds to load (Google, 2016, 10k domains) | Google/DoubleClick via MediaPost, Marketing Dive | Budget: property page LCP < 2.5 s on 4G mid-range Android. Treat as a product requirement |
| Skeletons reduce perceived wait mainly for waits of roughly 0.4–3 s; evidence is mixed (a Viget study found skeletons felt slower than spinners) | NN/g (as summarised, secondary); Viget | Avoid needing skeletons: server-render content. Use skeletons only for client-loaded sections, matched to final layout. No spinner over blank pages |

## 6. Airbnb, studied rather than copied

### What Airbnb does very well

1. **Photo-first everything.** Cards are mostly image; text is three short lines.
2. **Search is the home page.** The home is a results grid with a category bar, not a landing page.
3. **Split map on desktop.** Location is always visible while browsing.
4. **Total price.** After years of complaints, the price shown is the price paid.
5. **Wishlists as low-commitment "maybe".**
6. **Trust built from specific evidence**: reviews, host details, response rates.
7. **Calm visual system**: one accent colour, generous image size, restrained type.

### Where Airbnb is more complex than Rumia needs

| Airbnb | Why it exists there | Rumia |
|---|---|---|
| Where / When / Who before results | Nightly inventory depends on dates and guest count | **Monthly rentals need neither.** Ask nothing before showing results. Dates and guests appear only in "Nightly" mode |
| Booking and checkout with payment | Airbnb is the merchant | **No booking.** One tap to WhatsApp the person who has the keys |
| 60+ icon categories | Inspiration across millions of homes worldwide | **A handful of property types** that match local vocabulary (hostel, bedsitter, apartment, house) |
| Dozens of filters in a long modal | Huge, diverse inventory | 3 visible filters, about 6 more in a sheet, specific to the type |
| Account required to save and message | Platform messaging, payments, identity | **No account to browse, save on this phone, or contact** |
| Reviews as the main trust signal | Millions of stays create review volume | Reviews are sparse here. **Freshness, visit verification and real costs** do the work reviews do on Airbnb |

### If we built "Airbnb for Kenyan property discovery" today

We'd keep Airbnb's photo-first calm, search-as-home and split map. We'd remove dates, guests, booking, accounts and most filters from the default path. And we'd add what Airbnb doesn't need: availability freshness ("confirmed 2 days ago"), move-in cost, walking time to the place you care about, a safety note about deposits, and contact through the channel everyone already uses. **That is simpler than Airbnb because the Rumia decision is simpler: find a real place you can afford near where you need to be, then talk to the person with the keys.**

## 7. Other products: one principle each

| Product | Principle taken | Applied to Rumia |
|---|---|---|
| Google Maps | Places are understood spatially; "near me" and "near X" are first-class | Landmark anchors ("near DeKUT", "near Nyeri CBD") and walk times |
| Zillow / Rightmove | Saved searches with alerts are the retention engine for episodic search | "Tell me when something matches" as the main reason to give a phone number |
| Pinterest | Saving is cheap and visual, and boards organise intent | Saved list on the device, compare 2–3 |
| Spotify | Remembers you and resumes; explains recommendations | "Continue your search", reason chips on results |
| YouTube | Thumbnails and titles do the selling; play on demand | Video posters on property pages; tap to play; no autoplay on cellular |
| TikTok | Vertical, full-screen media with one action | A full-screen "walkthrough" viewer on property pages, not a feed home |
| Instagram | Profiles collect a creator's content | Lister profile page that owners can put in their bio |

---

## Sources

- Baymard Institute, "Hotel & Property Rental Search Results: Split View" — https://baymard.com/research-articles/accommodations-split-view
- Baymard Institute, Travel Accommodations UX benchmark — https://www.baymard.com/ux-benchmark/collections/travel-accommodations and https://baymard.com/research/travel-accommodations
- Baymard Institute, state of e-commerce filters — https://baymard.com/research-articles/external-article-state-of-ecommerce-filters
- Nielsen Norman Group, "Infinite Scrolling: When to Use It, When to Avoid It" — https://www.nngroup.com/videos/infinite-scrolling-when/
- Algolia, faceted search overview (secondary summary citing NN/g) — https://www.algolia.com/blog/ux/faceted-search-an-overview/
- WisePIM, mobile filter practices (secondary) — https://wisepim.com/blog/ecommerce-product-filters-ux-best-practices
- Google Developers Blog, OAuth in embedded webviews — https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
- Auth0, "Google blocks OAuth requests from embedded browsers" — https://auth0.com/blog/google-blocks-oauth-requests-from-embedded-browsers
- Business Daily Africa, Android share in Kenya — https://www.businessdailyafrica.com/bd/corporate/technology/google-s-android-system-powers-94pc-of-smartphones-in-kenya-4889274
- Business Daily Africa, Kenya mobile data pricing — https://www.businessdailyafrica.com/bd/economy/kenya-mobile-data-pricing-lowest-among-regional-peers-4731316
- TechCabal, data plans in Kenya (Aug 2025) — https://techcabal.com/?p=165500
- Capital FM, WhatsApp usage in Kenya — https://capitalfm.africa/whatsapp-usage-in-kenya-drops-as-tiktok-facebook-gain/
- Citizen Digital, housing scams in Nairobi — https://citizen.digital/article/housing-scams-surge-in-nairobis-prime-estates-as-foreign-demand-rises-n371915
- Kenyans.co.ke, house-hunting scams — https://www.kenyans.co.ke/news/57809-most-popular-house-hunting-scams-avoid-nairobi
- McTaba, scams targeting first-years (secondary) — https://mctaba.com/campus/scams-targeting-first-years-kenya
- Rightmove Property Marketing reports — https://hub.rightmove.co.uk/content/uploads/2020/09/Property-Marketing-2020.pdf
- Skift, Airbnb total price display — https://skift.com/?p=544891
- MediaPost / Marketing Dive, Google "Need for Mobile Speed" — https://www.marketingdive.com/news/google-53-of-mobile-users-abandon-sites-that-take-over-3-seconds-to-load/426070/
- Adobe Experience League, anonymous visitor personalization — https://experienceleague.adobe.com/en/docs/blueprints-learn/architecture/use-case-patterns/personalization-patterns/anonymous-visitor-web-personalization
- Carbon Design System, loading pattern — https://carbondesignsystem.com/patterns/loading-pattern
