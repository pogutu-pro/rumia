# Runbook: RumiaBnB on its own host

RumiaBnB is the same Next.js app as Rumia. `web/src/proxy.ts` serves it when the request's host is listed in `BNB_HOST`
(rewriting to the internal `app/bnb-site` segment). With `BNB_HOST` unset, nothing changes: every request is Rumia.

## Settings

| Where | Name | Value | When |
|---|---|---|---|
| server `web/.env.production` (runtime) | `BNB_HOST` | `rumiabnb.rumia.co.ke` | go-live (unset = off) |
| server `web/.env.production` (runtime) | `BNB_INDEXABLE` | `true` | once the site has real stays; until then robots.txt disallows everything |
| server `web/.env.production` (build) | `NEXT_PUBLIC_BNB_ORIGIN` | `https://rumiabnb.rumia.co.ke` | optional, this is the default |
| server `web/.env.production` (build) | `NEXT_PUBLIC_BNB_CONCIERGE_WHATSAPP` | the RumiaBnB WhatsApp number, e.g. `2547XXXXXXXX` | before go-live; empty hides the chat buttons |
| server `web/.env.production` (build) | `NEXT_PUBLIC_BNB_SEPARATE` | `true` | step 5 below: short stays leave Rumia's discovery and their Rumia URLs redirect to RumiaBnB |
| backend env | `BNB_CONCIERGE_WHATSAPP`, `BNB_PUBLIC_URL` | the same number; `https://rumiabnb.rumia.co.ke` | before go-live (see `0010-bnb-stays.md`) |
| backend env | `CORS_ORIGINS` | must include `https://rumiabnb.rumia.co.ke` if the server env overrides the default list | go-live |

`NEXT_PUBLIC_*` values are baked in at build time: change them, then redeploy.

## Go-live steps (in order)

1. **Certificate.** Add the host to the Let's Encrypt certificate on the server (the HTTP challenge is already served for
   it by `nginx/nginx.conf`):
   `docker compose run --rm certbot certonly --webroot -w /var/www/certbot --expand -d rumia.co.ke -d www.rumia.co.ke -d rumiabnb.rumia.co.ke`
   then `docker compose exec nginx nginx -s reload`. (Alternative: a Cloudflare origin certificate.)
2. **Env.** Set the values above in `web/.env.production`; redeploy (or `docker compose up -d --build web`).
3. **DNS (Cloudflare).** Add `rumiabnb` as a proxied record pointing at the same origin as `rumia.co.ke`.
4. **Check RumiaBnB alone first.**
   - `https://rumiabnb.rumia.co.ke/` shows RumiaBnB (no Rumia bottom bar), `/robots.txt` and `/manifest.webmanifest` are
     RumiaBnB's.
   - `https://rumia.co.ke/` is unchanged; `https://rumia.co.ke/bnb-site` is 404.
   - Sign-in on Rumia still works.

5. **Separate the products.** Set `NEXT_PUBLIC_BNB_SEPARATE=true` and redeploy. Check:
   - `rumia.co.ke` home and `/hostels` show no short stays; the title reads "Hostels, Bedsitters & Apartments"; the
     "RumiaBnB | Short stays" tile and the footer link go to RumiaBnB.
   - `/bnb`, `/nyeri/short-stays`, `/nyeri/short-stays/{place}/{name}` and `/p/{short-stay}` answer 307 to the matching
     RumiaBnB page, keeping `utm_*`.
   - Rumia's sitemap no longer lists short stays; RumiaBnB's does.
6. **After about two weeks without problems**, change `BNB_REDIRECT_STATUS` in `web/src/lib/site/separation.ts` to 308
   and resubmit both sitemaps in Google Search Console.

## Rollback

- Separation only: unset `NEXT_PUBLIC_BNB_SEPARATE` and redeploy (the redirects are 307, so browsers have not cached them).
- RumiaBnB entirely: as below.


Unset `BNB_HOST` and restart the web container. The subdomain then serves Rumia; remove the DNS record if needed.

## Moving to an own domain later

Add the new host to `BNB_HOST` (comma-separated), set `NEXT_PUBLIC_BNB_ORIGIN` to it, add it to nginx and CORS, and
301 the old subdomain to the new domain in nginx. Paths stay the same.
