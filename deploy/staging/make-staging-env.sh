#!/bin/bash
set -e
SRC=/opt/flashmuse/data/.env.local
DST=/opt/flashmuse-staging/data/.env.local
cp "$SRC" "$DST"

set_kv() {
  key="$1"; val="$2"
  if grep -qE "^${key}=" "$DST"; then
    # replace whole line
    python3 - "$DST" "$key" "$val" <<'PY'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding="utf-8").read().split("\n")
out = []
done = False
for ln in lines:
    if ln.startswith(key + "="):
        out.append(f"{key}={val}")
        done = True
    else:
        out.append(ln)
if not done:
    out.append(f"{key}={val}")
open(path, "w", encoding="utf-8").write("\n".join(out))
PY
  else
    echo "${key}=${val}" >> "$DST"
  fi
}

set_kv FORCE_INSECURE_AUTH_COOKIE true
set_kv AUTH_COOKIE_DOMAIN ""
set_kv NEXT_PUBLIC_PRIMARY_BASE_URL "http://101.37.129.164:8080"
set_kv NEXT_PUBLIC_UPLOAD_BASE_URL "http://101.37.129.164:8080"
set_kv NEXT_PUBLIC_STATIC_BASE_URL ""
set_kv UPLOAD_CORS_ORIGINS "http://101.37.129.164:8080"
set_kv ALI_SYNC_GENERATED_ENABLED true
set_kv ALI_SYNC_DEST_ROOT "/var/www/flashmuse-static-test/generated"
set_kv NEXT_PUBLIC_IS_TEST true

echo "=== staging .env.local (secrets masked) ==="
sed -E 's/(KEY|SECRET|PASS|SECRET_KEY|AUTH_SECRET|DATABASE_URL|SMTP_USER|SMTP_FROM|MODEL_PROVIDER_PREFERENCES|BYTEPLUS_MODEL_SELECTIONS|UPLOAD_RULE_OVERRIDES)=(.{4}).*/\1=\2****/' "$DST"
