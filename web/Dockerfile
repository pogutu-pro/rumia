# syntax=docker/dockerfile:1

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

# Prepare the dotenv file that Next.js will read at build time.
# See https://github.com/vercel/next.js — @next/env only applies a .env.*
# value when the variable is UNDEFINED in process.env. Docker build args are
# injected into the shell environment of every RUN, so declaring them in the
# builder stage would set NEXT_PUBLIC_* to "" (empty from compose) and make
# Next SKIP the real .env.production values. To avoid that, args are consumed
# exclusively in this separate stage and the patched dotenv file is handed to
# the builder via COPY --from — the builder declares no NEXT_PUBLIC_* ARG at all.
FROM base AS envprep
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
# Server-only secret needed by some modules (e.g. supabaseAdmin) during
# build-time page-data collection. Only exists as a build arg here; never
# baked into the final image.
ARG SUPABASE_SERVICE_ROLE_KEY
RUN set -e; for v in \
      NEXT_PUBLIC_SUPABASE_URL \
      NEXT_PUBLIC_SUPABASE_ANON_KEY \
      NEXT_PUBLIC_GOOGLE_CLIENT_ID \
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID \
      NEXT_PUBLIC_POSTHOG_HOST \
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN \
      NEXT_PUBLIC_VAPID_PUBLIC_KEY \
      NEXT_PUBLIC_SENTRY_DSN \
      SUPABASE_SERVICE_ROLE_KEY; do \
        val="$(printenv "$v" || true)"; \
        if [ -n "$val" ]; then echo "$v=$val" >> .env.production; fi; \
    done

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Restore the env-patched dotenv over the raw build-context copy so
# Next.js reads merged values (real .env.production + non-empty args).
COPY --from=envprep /app/.env.production ./.env.production

# Environment variables must be present at build time
# (We pass these in via docker-compose build args or environment)
# Override API base URL so server components call the backend via the
# internal docker network (http://backend:8000) instead of looping out
# through the public domain. Next.js respects existing process env vars
# over .env.production dotfile values, so the ARG wins at build time.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
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