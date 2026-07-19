#!/bin/bash
set -e
KEY=/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519
ALI=root@101.37.129.164
SSHOPT="ssh -i $KEY -o StrictHostKeyChecking=no"

sudo ssh -o StrictHostKeyChecking=no -i $KEY $ALI 'mkdir -p /var/www/flashmuse-static-test/_next/static /var/www/flashmuse-static-test/home-assets /var/www/flashmuse-static-test/generated'

sudo rm -rf /tmp/staging-next-static
sudo docker cp flashmuse-staging-staging-app-1:/app/.next/static /tmp/staging-next-static
sudo rsync -a --delete -e "$SSHOPT" /tmp/staging-next-static/ $ALI:/var/www/flashmuse-static-test/_next/static/

sudo rsync -a -e "$SSHOPT" /opt/flashmuse-staging/data/home-assets/ $ALI:/var/www/flashmuse-static-test/home-assets/

sudo rsync -a -e "$SSHOPT" /opt/flashmuse-staging/data/generated/ $ALI:/var/www/flashmuse-static-test/generated/

echo "staging ali sync done"
