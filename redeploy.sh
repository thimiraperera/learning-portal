#!/bin/sh
# Force redeploy: pull, npm install, KILL the old worker, restart, verify.
# Use this when a normal restart does not pick up server.cjs/db.cjs changes
# (the "stale LiteSpeed worker" problem). Run on the server: sh redeploy.sh
set -e

APP_ROOT=/home/cemszolc/learning-portal
NODE_ENV_ACTIVATE=/home/cemszolc/nodevenv/learning-portal/24/bin/activate
SITE=https://lms.cem.lk/

. "$NODE_ENV_ACTIVATE"
cd "$APP_ROOT"

echo "==> git pull"
git pull

echo "==> npm install"
npm install

# Kill every running worker for this app. LiteSpeed names the process
# lsnode:<app_root>/ , so pkill -f server.cjs does NOT match it. Match the path.
kill_workers() {
  PIDS=$(ps aux | grep -i "lsnode:$APP_ROOT\|$APP_ROOT/server.cjs" | grep -v grep | awk '{print $2}')
  if [ -n "$PIDS" ]; then
    echo "   killing PIDs: $PIDS"
    kill $PIDS 2>/dev/null || true
    sleep 2
    # Force-kill any that ignored SIGTERM.
    SURV=$(ps aux | grep -i "lsnode:$APP_ROOT\|$APP_ROOT/server.cjs" | grep -v grep | awk '{print $2}')
    [ -n "$SURV" ] && { echo "   force-killing: $SURV"; kill -9 $SURV 2>/dev/null || true; }
  else
    echo "   (no running worker found)"
  fi
}

echo "==> stop app"
cloudlinux-selector stop --json --interpreter nodejs --app-root "$APP_ROOT" || true

echo "==> kill stale workers"
kill_workers

echo "==> start app"
cloudlinux-selector start --json --interpreter nodejs --app-root "$APP_ROOT"
touch tmp/restart.txt

echo "==> boot (runs init migrations)"
curl -skL -o /dev/null -w "boot: %{http_code}\n" "$SITE"

verify() {
  LIVE=$(curl -s "$SITE" | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -n1)
  WANT=$(grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html | head -n1)
  echo "   live:      $LIVE"
  echo "   committed: $WANT"
  [ "$LIVE" = "$WANT" ]
}

echo "==> verify live bundle"
if verify; then
  echo "OK: new code is live."
  exit 0
fi

# One more aggressive pass if it is still serving the old bundle.
echo "MISMATCH: retrying with a hard kill..."
kill_workers
cloudlinux-selector start --json --interpreter nodejs --app-root "$APP_ROOT"
touch tmp/restart.txt
curl -skL -o /dev/null -w "boot: %{http_code}\n" "$SITE"

echo "==> verify again"
if verify; then
  echo "OK: new code is live."
else
  echo "STILL STALE. Inspect manually:"
  echo "  ps aux | grep -i 'lsnode:$APP_ROOT' | grep -v grep"
  exit 1
fi
