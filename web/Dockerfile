FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables must be present at build time
# (We pass these in via docker-compose build args or environment)
# Override API base URL so server components call the backend via the
# internal docker network (http://backend:8000) instead of looping out
# through the public domain.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Optional public build-time env vars. Values come from docker compose build
# args (themselves interpolated from shell/env or web/.env.production).
# Only var entries that are non-empty are appended to the in-image
# .env.production so Next.js can read them at build time. Empty args are
# skipped so they never shadow the real dotenv file values on the VPS.
# Server-only secret used by some modules (e.g. supabaseAdmin) at build-time
# page-data collection. Passed purely as a build arg; NOT baked via ENV into the
# final image. Placed on the dotenv file so Next reads it only while it exists.
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
RUN set -e; for v in \
      SUPABASE_SERVICE_ROLE_KEY \
      NEXT_PUBLIC_SUPABASE_URL \
      NEXT_PUBLIC_SUPABASE_ANON_KEY \
      NEXT_PUBLIC_GOOGLE_CLIENT_ID \
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID \
      NEXT_PUBLIC_POSTHOG_HOST \
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN \
      NEXT_PUBLIC_VAPID_PUBLIC_KEY \
      NEXT_PUBLIC_SENTRY_DSN; do \
        val="$(printenv "$v" || true)"; \
        if [ -n "$val" ]; then echo "$v=$val" >> .env.production; fi; \
    done
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
