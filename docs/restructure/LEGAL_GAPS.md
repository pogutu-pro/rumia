# Privacy Policy and Terms of Service: gaps to review

Status: 2026-10-10. This is a code-versus-document comparison, not legal advice. The documents are stored in the
database (`legal_documents`, edited at `/admin/legal`) and rendered at `/policy` and `/terms`. Nothing in the pages was
rewritten. The text read below came from the local development database; production may differ, so compare before acting.

## Privacy Policy: practices in the code that the text does not name

| Practice (where) | What the policy says today |
|---|---|
| Anonymous device id cookie `rumia_did`, used to keep saves, searches and contacts for visitors without an account, linked to the account on sign-in (`lib/device.ts`) | Cookies section lists only session cookies, OAuth session storage and analytics |
| Wishlist/saves, search history and viewing taste kept on the device in `localStorage` (`lib/personalisation.ts`, `recently-viewed.ts`, `stores/compare-store.ts`, `lib/contact.ts` follow-up prompt) | Says session storage only |
| Web push subscriptions and push opt-in (`/api/push/*`, `usePushSubscription`) | Mentions "WhatsApp or email" notifications only |
| Named third parties: PostHog (analytics), Sentry (error reports), Cloudflare Web Analytics, Google sign-in, Google Maps, YouTube (video embeds and player API) | "Analytics tools" in general; Cloudflare for CDN/storage |
| Find Me a Hostel requests: budget, gender, room, furnishing and stay preferences, move-in date, service-fee acceptance | Not listed under information collected |
| Contact logging with a reference code (`/api/v1/inquiries`) | Described as "contact leads for commission attribution" |
| Agent applications and listings data | Not covered |

## Privacy Policy: items that need a decision or evidence from the owner

- Data retention periods: none stated.
- Hosting and international transfers (Cloudflare, Google, PostHog, Sentry): not stated.
- Registration with the Office of the Data Protection Commissioner and any Data Protection Act references: none present.
- Lawful basis and consent wording for analytics and push: not stated.
- "Encryption at rest and in transit" and "respond within 14 days": these are commitments the owner must confirm are true.
- "University and year of study": confirm it is still collected.
- Effective date (2025-06-01) versus last updated (2026-10-09): confirm which changes the latest update covers.
- Scope: the text is written for students near DeKUT; the product also lists apartments and short stays.

## Terms of Service

- Scope: written as a "hostel listing and lead generation platform" for students near DeKUT; apartments, short stays and non-student users are not addressed.
- Section 3 says a visitor must be signed in to contact a listing; confirm this still matches the contact flow, since saves and some contact logging now work for anonymous devices.
- Commission and consultation-fee terms (40/60 split, campus-set fee) should be confirmed against current business rules.
- Neither document states a governing law, dispute process or limitation of liability beyond what the text already contains; whether to add them is a legal decision.

## What the pages do now

Both pages render the stored HTML in the shared application shell. Privacy and Terms links appear at the foot of the sidebar,
in the mobile menu and in the page footer.
