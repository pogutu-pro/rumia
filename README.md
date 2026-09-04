# Rumia — Student Hostel Discovery & Booking Platform

> Find verified, affordable student accommodation near Kenyan universities.

## 📁 Repository Structure

```
rumia/
├── web/              # Next.js 14 frontend (TypeScript, Tailwind CSS, PWA)
├── backend/          # FastAPI backend (Python 3.12, SQLAlchemy 2, Async PostgreSQL)
├── mobile/           # Mobile app (coming soon)
├── nginx/            # Nginx reverse proxy configuration
├── scripts/          # Deployment, CI validation & utility scripts
├── docs/             # Developer guides and architecture documentation
│   ├── DEPLOYMENT.md         # Step-by-step Oracle VPS deployment guide
│   ├── architecture/         # System architecture documentation
│   └── internal/             # Internal planning & research notes
├── data/             # Seed data & migration CSV files
├── supabase/         # Supabase migrations & database schema
├── .github/          # GitHub Actions CI/CD workflows (push-to-deploy)
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start (Local Development)

### Backend
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

### Frontend
```bash
cd web
pnpm install
pnpm dev
```

## 📦 Production Deployment

Full step-by-step Oracle VPS deployment guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## ✅ Pre-push Checks
```bash
./scripts/pre-push-check.sh
```

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Serwist PWA |
| Backend API | Python 3.12, FastAPI, SQLAlchemy 2 (Async), PostgreSQL |
| Auth | Supabase JWT |
| Storage | Cloudflare R2 |
| Hosting | Oracle Cloud VPS, Johannesburg (`af-johannesburg-1`) |
| Reverse Proxy | Nginx + Let's Encrypt SSL |
| CI/CD | GitHub Actions (push-to-deploy) |
