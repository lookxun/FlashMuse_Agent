# FlashMuse production image (Tencent Singapore, Docker deploy)
FROM node:22-bookworm-slim

# Tools: rsync/ssh needed for ali-sync (phase 3); curl is the fallback HTTP client for BytePlus/OpenRouter
# (openrouter.ts curlPostJson) — without it the fallback throws "spawn curl ENOENT"; ffmpeg-static & sharp ship their own binaries
RUN apt-get update \
  && apt-get install -y --no-install-recommends rsync openssh-client ca-certificates curl \
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
# 测试服标识：仅测试服构建时传 "true"（compose build arg），正式服不传 → 空 → 不显示测试服标识/(t)
ARG NEXT_PUBLIC_IS_TEST=
ENV NEXT_PUBLIC_IS_TEST=${NEXT_PUBLIC_IS_TEST}
# 上传主源地址：NEXT_PUBLIC_* 构建期内联。正式服默认空 → getStaticMediaUrl 回退到硬编码生产 api.venusface.com（正确）。
# 测试服必须传 build arg（如 http://101.37.129.164:8080）否则"本会话刚上传"的媒体会被错误改写到生产地址导致封面/视频 404。
ARG NEXT_PUBLIC_UPLOAD_BASE_URL=
ENV NEXT_PUBLIC_UPLOAD_BASE_URL=${NEXT_PUBLIC_UPLOAD_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["sh","/app/docker-entrypoint.sh"]
