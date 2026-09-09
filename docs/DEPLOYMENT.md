# Rumia Platform — Complete Oracle VPS Production Deployment Guide

This guide provides step-by-step instructions for deploying the Rumia platform (FastAPI Backend + Next.js Frontend + Nginx Reverse Proxy + Certbot SSL) on an **Oracle Cloud Infrastructure (OCI) VPS** in the **Johannesburg, South Africa region (`af-johannesburg-1`)**.

---

## 🏗️ Production Architecture Overview

- **Hosting Provider**: Oracle Cloud Infrastructure (OCI).
- **Datacenter Region**: `af-johannesburg-1` (Johannesburg, South Africa) — Provides ~25-45ms ping to Kenya (DeKUT students/agents).
- **Target Instance Specs**: Oracle Always Free Ampere A1 (ARM64, up to 4 OCPUs, 24GB RAM) or standard E2/E4 Flex instance.
- **Software Stack**:
  - **Reverse Proxy**: Nginx (Alpine) with HTTP/2, TLS 1.3, rate limiting, and gzip compression.
  - **SSL Certificates**: Let's Encrypt Certbot with automatic 12-hour renewal sidecar.
  - **Backend API**: Python 3.12 FastAPI served via Gunicorn process manager with `uvicorn.workers.UvicornWorker`.
  - **Frontend Web**: Next.js (Node.js 20 Alpine) with `output: 'standalone'` file tracing (~120MB image footprint).
  - **Container Isolation**: Docker Compose with custom bridge network (`rumia-network`) and non-root application execution.
  - **Vercel-like CI/CD**: Automated GitHub Actions workflow testing on PRs and auto-deploying to Oracle VPS on `git push main`.

---

## 📦 Repository Layout / Branch Contract (read this first)

The **deployable tree lives on the `migration/fastapi` branch** and is merged into `main`.
`main` currently holds the **legacy pre-migration layout** (`src/` at repo root, no
`web/`, no `backend/`, no `docker-compose.yml`) — do **not** run `docker compose` against it.

Merge order:

```bash
git checkout migration/fastapi
git push origin migration/fastapi
# Open a PR: migration/fastapi -> main, merge it (CI runs; CD auto-deploys once §secrets exist)
git checkout main && git pull --rebase
```

> **Important:** pause/disable Vercel auto-deploys on the same GitHub repo before merging.
> The current domain (`rumia.co.ke`) still points at Vercel; until DNS is re-pointed (§"DNS
> A-Records"), merging the new tree will make Vercel try to build it without the new secrets.

### How the web talks to the backend (internal network URL)

`docker-compose.yml` builds the web with `NEXT_PUBLIC_API_BASE_URL=http://backend:8000/api/v1`.
Server components therefore fetch FastAPI **over the docker network** — no public hairpin
round-trip, and SSR traffic bypasses the nginx rate limiter. **Browsers never call FastAPI
directly** (verified: no client component imports `getApiUrl`/`apiClient`). The exact
mechanism: `web/Dockerfile` declares `ARG NEXT_PUBLIC_API_BASE_URL` → `ENV` before
`pnpm build`, and Next.js gives existing process env precedence over `.env.production`.

---

## ⚡ Vercel-Style Automated CI/CD Deployment (Push-to-Deploy)

Just like Vercel, every `git push` to your GitHub repository automatically:
1. Runs full backend `pytest` suite.
2. Runs frontend TypeScript typechecks (`tsc --noEmit`) and Next.js standalone build checks.
3. If tests pass, connects to your Oracle VPS via SSH and deploys the updated code automatically with zero downtime.

### How to Enable Vercel-Style Auto-Deployment:

Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions** -> Click **New repository secret**:

| Secret Name | Value | Example |
|---|---|---|
| `ORACLE_VPS_HOST` | Oracle VPS Public IP Address | `129.159.x.x` |
| `ORACLE_VPS_USER` | SSH Username for Oracle VPS | `ubuntu` |
| `ORACLE_VPS_SSH_KEY` | Private SSH Key contents | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |

Once these 3 secrets are set, any `git push` to `main` will test and deploy automatically!

---

## 📋 Step 1: Provisioning Oracle VPS Instance

1. Log into your **Oracle Cloud Infrastructure (OCI)** Console.
2. Ensure your region selector in the top right is set to **`af-johannesburg-1` (South Africa East - Johannesburg)**.
3. Go to **Compute** -> **Instances** -> Click **Create Instance**.
4. Configure Instance Settings:
   - **Name**: `rumia-prod-vps`
   - **Image**: `Canonical Ubuntu 22.04 LTS` or `24.04 LTS` (Minimal).
   - **Shape**:
     - *Option A (Recommended)*: `VM.Standard.A1.Flex` (Ampere ARM64) — Allocate **2 to 4 OCPUs** and **12 to 24 GB RAM**.
     - *Option B*: `VM.Standard.E2.1.Micro` or `VM.Standard.E4.Flex` (x86_64).
   - **Networking**: Select your default Virtual Cloud Network (VCN) and Assign a **Public IPv4 Address**.
   - **SSH Keys**: Download and save your private SSH key (`rumia-vps.key`).
5. Click **Create** and copy your instance's **Public IP Address** (e.g. `129.159.x.x`).

---

## 🔒 Step 2: Configure Oracle Cloud VCN Security List (Cloud Firewall)

By default, Oracle Cloud blocks incoming HTTP/HTTPS connections at the network layer.

1. Go to **Networking** -> **Virtual Cloud Networks**.
2. Click your VCN -> Click **Security Lists** -> Select the **Default Security List**.
3. Under **Ingress Rules**, click **Add Ingress Rules**:

| Source Type | CIDR / Source | IP Protocol | Source Port Range | Destination Port | Description |
|---|---|---|---|---|---|
| CIDR | `0.0.0.0/0` | TCP | All | `80` | Allow HTTP |
| CIDR | `0.0.0.0/0` | TCP | All | `443` | Allow HTTPS |

4. Click **Add Ingress Rules**.

---

## 🌐 Step 3: Configure Domain DNS A-Records

Point your registered domain (`rumia.co.ke`) to your Oracle VPS Public IP:

1. Log into your domain registrar dashboard (e.g. Hostinger, Cloudflare, Sasahost).
2. Go to **DNS Management** for `rumia.co.ke`.
3. Add the following records:

| Type | Name | Value / Target | TTL |
|---|---|---|---|
| **A** | `@` | `YOUR_ORACLE_VPS_PUBLIC_IP` | 3600 |
| **A** | `www` | `YOUR_ORACLE_VPS_PUBLIC_IP` | 3600 |

*(DNS propagation usually takes 5 to 15 minutes).*

> If you proxy through Cloudflare (orange cloud): set SSL/TLS mode to **Full** — the VPS
> nginx terminates Let's Encrypt TLS on 443, so Cloudflare must connect to 443, not 80.
> Grey-cloud (DNS-only) also works and exposes the origin IP.
> Sweep after changing: `dig +short rumia.co.ke www.rumia.co.ke`.

---

## 💻 Step 4: Server OS Setup & Operating System Firewall

SSH into your Oracle VPS instance:
```bash
ssh -i /path/to/rumia-vps.key ubuntu@YOUR_ORACLE_VPS_PUBLIC_IP
```

### 1. Update OS Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Configure OS Firewall (`iptables` / `netfilter-persistent`)
Oracle Ubuntu images ship with strict default `iptables` rules that block HTTP traffic even after opening OCI security lists. Run:

```bash
# Allow HTTP and HTTPS traffic in OS iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Save iptables rules across server reboots
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## 🐳 Step 5: Install Docker & Docker Compose

Run the official Docker installation script on Ubuntu:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker $USER

# Log out and log back in to apply group permissions
exit
```

SSH back into your server and test Docker:
```bash
docker --version
docker compose version
```

---

## 📦 Step 6: Clone Codebase & Configure Environment Variables

```bash
# Clone the repository
git clone https://github.com/YourOrg/rumia.git /home/ubuntu/rumia
cd /home/ubuntu/rumia
```

Both required env files are **gitignored**, so `git pull` will never bring them —
they exist locally with real values, so **scp them** (no drift):

```bash
scp web/.env.production  ubuntu@YOUR_ORACLE_VPS_PUBLIC_IP:/home/ubuntu/rumia/web/.env.production
scp backend/.env         ubuntu@YOUR_ORACLE_VPS_PUBLIC_IP:/home/ubuntu/rumia/backend/.env
```

Edit them if needed:
```bash
nano backend/.env        # or: cp backend/.env.example backend/.env
nano web/.env.production
```

Required keys:

**`backend/.env`**
```env
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://<USER>:<PASSWORD>@<HOST>:6543/<DB_NAME>   # Supabase pooler
SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=<YOUR_ANON_KEY>                # backend reads via anon key + RLS (read-only)
SUPABASE_JWT_SECRET=<YOUR_SUPABASE_JWT_SECRET>
R2_ACCOUNT_ID=<YOUR_R2_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<YOUR_R2_KEY>
R2_SECRET_ACCESS_KEY=<YOUR_R2_SECRET>
R2_BUCKET_NAME=<YOUR_R2_BUCKET_NAME>
R2_PUBLIC_URL=https://images.rumia.co.ke
VAPID_PUBLIC_KEY=<...>  VAPID_PRIVATE_KEY=<...>  VAPID_SUBJECT=mailto:support@rumia.co.ke
POSTHOG_PROJECT_TOKEN=<...>  POSTHOG_HOST=https://eu.i.posthog.com
# optional: SENTRY_DSN=
```

**`web/.env.production`** (injected by compose at build — `NEXT_PUBLIC_*` — and at runtime)
```env
NEXT_PUBLIC_API_BASE_URL=https://rumia.co.ke/api/v1   # used only as dotenv fallback; compose overrides with internal URL
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
R2_ACCOUNT_ID=<...>  R2_ACCESS_KEY_ID=<...>  R2_SECRET_ACCESS_KEY=<...>  R2_BUCKET_NAME=<...>
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<...>  VAPID_PRIVATE_KEY=<...>
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=<...>  NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<...>  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<...>
# optional (empty SENTRY_AUTH_TOKEN skips sourcemap uploads):
# NEXT_PUBLIC_SENTRY_DSN= SENTRY_ORG= SENTRY_PROJECT= SENTRY_AUTH_TOKEN=
```

---

## 🔐 Step 7: Bootstrap Let's Encrypt SSL Certificates

Run the automated SSL bootstrap script:

```bash
cd /home/ubuntu/rumia
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh
```

This script will:
1. Generate temporary SSL keys to allow Nginx to start.
2. Request official multi-domain SSL certificates for `rumia.co.ke` and `www.rumia.co.ke` from Let's Encrypt.
3. Automatically load the production certificates into Nginx.

---

## 🚀 Step 8: Deploy Platform

Run the automated zero-downtime deployment script:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

---

## 🧪 Local Developer Verification Before Pushing

Developers can run the local pre-push validation script before committing to catch errors early:

```bash
chmod +x scripts/pre-push-check.sh
./scripts/pre-push-check.sh
```

This runs:
1. **`pytest`** — Full backend test suite (77 tests).
2. **`tsc --noEmit`** — Frontend TypeScript typecheck.
3. **Docker Compose config** — Validates `docker-compose.yml` syntax (skipped gracefully if Docker is not installed locally).

Expected output:
```
=== [1/3] Running Backend Pytest Suite ===
91 passed in 4s
✓ Backend tests passed!
=== [2/3] Running Frontend TypeScript Typecheck ===
✓ Frontend typecheck passed!
=== [3/3] Validating Docker Compose Build Syntax (optional) ===
✓ Docker Compose configuration valid!

======================================================================
🎉 ALL LOCAL CHECKS PASSED! Safe to commit and push code.
======================================================================
```

---

## ⚙️ CI/CD Pipeline Reference (GitHub Actions)

The project ships two GitHub Actions workflows that together replace Vercel:

### Pipeline Flow

```
git push origin main
        │
        ▼
.github/workflows/ci.yml
  ├── Job 1: Backend Pytest
  │     └── pytest tests/ -v
  ├── Job 2: Frontend TypeScript + Next.js Build
  │     ├── tsc --noEmit
  │     └── pnpm build (standalone)
  └── Job 3: Docker Compose Build Test
        └── docker compose build
        │
        ▼ (all 3 jobs pass)
.github/workflows/cd.yml
  └── SSH into Oracle VPS → ./scripts/deploy.sh
        ├── git pull origin main
        ├── docker compose build --pull
        ├── docker compose up -d
        ├── docker compose ps (health check)
        └── nginx -s reload
```

### GitHub Repository Secrets Required

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Example |
|---|---|---|
| `ORACLE_VPS_HOST` | Oracle VPS Public IP | `129.159.x.x` |
| `ORACLE_VPS_USER` | SSH login username | `ubuntu` |
| `ORACLE_VPS_SSH_KEY` | Full private SSH key file contents | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

> **Tip**: Copy the full contents of your `rumia-vps.key` file (including the `-----BEGIN` and `-----END` lines) and paste as the `ORACLE_VPS_SSH_KEY` secret value.

---

## 📊 Step 9: Verification & Health Checks

Verify all 4 production containers are healthy and running:
```bash
docker compose ps
```

Expected output:
```
NAME             SERVICE    STATUS         PORTS
rumia_backend    backend    Up (healthy)   127.0.0.1:8000->8000/tcp
rumia_certbot    certbot    Up
rumia_nginx      nginx      Up             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
rumia_web        web        Up             127.0.0.1:3000->3000/tcp
```

Test public endpoints:
- **Frontend App**: `https://rumia.co.ke`
- **Web container liveness**: `https://rumia.co.ke/healthz` → `{"status":"ok"}`
- **API Health Check**: `https://rumia.co.ke/api/v1/health/liveness` → `{"status":"ok"}`
- **Swagger API Docs**: `https://rumia.co.ke/docs`
- **Campuses**: `https://rumia.co.ke/api/v1/campuses`
- **Search**: `curl 'https://rumia.co.ke/api/v1/search?q=kimathi'`
- **Top-10 real view counts**: `curl 'https://rumia.co.ke/api/v1/listings?sort=views&limit=10'`
- **Auth workflow**: register/login on the site (Supabase cookie session)
- **Image upload**: submit a listing with a photo >1 MB (validates the nginx `30m` body limit and R2 flow)

---

## 🛠️ Operations & Troubleshooting

### View Live Logs
```bash
# All containers
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f web
docker compose logs -f nginx
```

### Restart a Service
```bash
docker compose restart backend
docker compose restart web
```

### Check Resource Usage
```bash
docker stats
```

### Manual Deployment Update
```bash
cd /home/ubuntu/rumia
./scripts/deploy.sh
```

### Renew SSL Certificates Manually
Certbot auto-renews every 12 hours, but to trigger manually:
```bash
docker compose run --rm certbot renew
docker compose exec nginx nginx -s reload
```

### Hard Restart Everything
```bash
docker compose down
docker compose up -d
```

### Production Behavior Notes
- **Uploads:** `nginx` allows `client_max_body_size 30m` for the Next.js
  `/api/images/process` handler; final images are pushed direct to R2 (presigned PUT).
- **ISR staleness:** campuses + listing-detail pages revalidate every **300 s** so a
  backend-down docker build can never wedge fallback data for long; a CDN in front
  provides the long-term cache.
- **Rate limiting:** nginx `limit_req` (30 r/s, burst 20) applies only to `/api/v1/`
  traffic through the proxy (public browser/mobile). SSR traffic uses the internal
  `http://backend:8000` URL and bypasses it. Raise when mobile launches.
- **DB safety:** the backend reads via anon key + RLS (read-only). Schema changes are
  additive Supabase CLI migrations only — never destructive; don't hand the backend the
  service-role key for data access.

