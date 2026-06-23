#!/bin/sh
# Pull the latest code, restart the Node app, and verify the live bundle.
# Run on the cPanel server from the app root: sh deploy.sh
# Pass --install to also run npm install (only needed when dependencies change).
set -e

APP_ROOT=/home/cemszolc/learning-portal
NODE_ENV_ACTIVATE=/home/cemszolc/nodevenv/learning-portal/24/bin/activate
SITE=https://lms.cem.lk/

. "$NODE_ENV_ACTIVATE"
cd "$APP_ROOT"

echo "==> git pull"
git pull

if [ "$1" = "--install" ]; then
  echo "==> npm install"
  npm install
fi

echo "==> stop app"
cloudlinux-selector stop  --json --interpreter nodejs --app-root "$APP_ROOT" || true
echo "==> start app"
cloudlinux-selector start --json --interpreter nodejs --app-root "$APP_ROOT"
touch tmp/restart.txt

echo "==> boot (runs init migrations)"
curl -skL -o /dev/null -w "boot: %{http_code}\n" "$SITE"

echo "==> live bundle (should match dist/index.html)"
LIVE=$(curl -s "$SITE" | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -n1)
WANT=$(grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html | head -n1)
echo "live:      $LIVE"
echo "committed: $WANT"
if [ "$LIVE" = "$WANT" ]; then
  echo "OK: new code is live."
else
  echo "MISMATCH: old process still running. Kill the stale worker by PID:"
  echo "  ps aux | grep -i 'lsnode\\|server.cjs' | grep -v grep"
  echo "  kill <PID>   # process name: lsnode:$APP_ROOT/"
  echo "then re-run this script."
  exit 1
fi
