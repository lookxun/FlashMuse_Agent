# FlashMuse production image (Tencent Singapore, Docker deploy)
FROM node:22-bookworm-slim

# Tools: rsync/ssh needed for ali-sync (phase 3); ffmpeg-static & sharp ship their own binaries
RUN apt-get update \
  && apt-get install -y --no-install-recommends rsync openssh-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching. patches/ must exist before postinstall (patch-package / tldraw license patch)
COPY package.json package-lock.json* ./
COPY patches ./patches
RUN npm install --no-audit --no-fund

# App source (see .dockerignore: node_modules/.next/.git/.runtime/public/generated/.env* excluded)
COPY . .

RUN npx prisma generate

# NEXT_PUBLIC_* are baked at build time. Phase-1 IP testing keeps URL bases empty (same-origin);
# workflow mode stays open like production.
ARG NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true
ENV NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=${NEXT_PUBLIC_WORKFLOW_MODE_ENABLED}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["sh","/app/docker-entrypoint.sh"]
