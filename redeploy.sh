#!/bin/sh
# Force redeploy: pull, npm install, KILL the old worker, restart, verify.
# Use this when a normal restart does not pick up server.cjs/db.cjs changes
# (the "stale LiteSpeed worker" problem). Run on the server: sh redeploy.sh
#
# NOTE: intentionally NOT using `set -e`. A benign non-zero (e.g. no stale
# worker to kill) must never abort the script before the app is restarted.

APP_ROOT=/home/cemszolc/learning-portal
NODE_ENV_ACTIVATE=/home/cemszolc/nodevenv/learning-portal/24/bin/activate
SITE=https://lms.cem.lk/

. "$NODE_ENV_ACTIVATE"
cd "$APP_ROOT" || { echo "FATAL: cannot cd to $APP_ROOT"; exit 1; }

echo "==> git pull"
git pull || echo "WARN: git pull failed, continuing with current code"

echo "==> npm install"
npm install || echo "WARN: npm install failed, continuing"

# Kill every running worker for this app. LiteSpeed names the process
# lsnode:<app_root>/ , so pkill -f server.cjs does NOT match it. Match the path.
# Always returns 0 so it never aborts the restart that follows.
kill_workers() {
  PIDS=$(ps aux | grep -i "lsnode:$APP_ROOT\|$APP_ROOT/server.cjs" | grep -v grep | awk '{print $2}')
  if [ -n "$PIDS" ]; then
    echo "   killing PIDs: $PIDS"
    kill $PIDS 2>/dev/null
    sleep 2
    SURV=$(ps aux | grep -i "lsnode:$APP_ROOT\|$APP_ROOT/server.cjs" | grep -v grep | awk '{print $2}')
    if [ -n "$SURV" ]; then
      echo "   force-killing: $SURV"
      kill -9 $SURV 2>/dev/null
    fi
  else
    echo "   (no running worker found)"
  fi
  return 0
}

# Stop, kill any survivors, then start. start ALWAYS runs.
restart_app() {
  echo "==> stop app"
  cloudlinux-selector stop --json --interpreter nodejs --app-root "$APP_ROOT" 2>/dev/null
  echo "==> kill stale workers"
  kill_workers
  echo "==> start app"
  cloudlinux-selector start --json --interpreter nodejs --app-root "$APP_ROOT"
  mkdir -p tmp
  touch tmp/restart.txt
  echo "==> boot (runs init migrations)"
  curl -skL -o /dev/null -w "boot: %{http_code}\n" "$SITE"
}

verify() {
  LIVE=$(curl -s "$SITE" | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -n1)
  WANT=$(grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html | head -n1)
  echo "   live:      $LIVE"
  echo "   committed: $WANT"
  [ -n "$LIVE" ] && [ "$LIVE" = "$WANT" ]
}

restart_app

echo "==> verify live bundle"
if verify; then
  echo "OK: new code is live."
  exit 0
fi

echo "MISMATCH: retrying with another hard kill + restart..."
restart_app

echo "==> verify again"
if verify; then
  echo "OK: new code is live."
  exit 0
else
  echo "STILL STALE. The app IS running, but it is serving the old bundle. Inspect:"
  echo "  ps aux | grep -i 'lsnode:$APP_ROOT' | grep -v grep"
  exit 1
fi
