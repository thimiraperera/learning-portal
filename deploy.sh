#!/bin/sh
# Pull the latest code, restart the Node app, and verify the live bundle.
# Run on the cPanel server from the app root: sh deploy.sh
# npm install runs by itself when package.json or the lockfile changed since
# the last successful install, or a package is missing. Pass --install to force it.
set -e

APP_ROOT=/home/cemszolc/learning-portal
NODE_ENV_ACTIVATE=/home/cemszolc/nodevenv/learning-portal/24/bin/activate
SITE=https://lms.cem.lk/

. "$NODE_ENV_ACTIVATE"
cd "$APP_ROOT"

echo "==> git pull"
git pull

# npm install only when the packages changed since the last successful install
# (recorded in STAMP), a server package does not load, or --install is given.
# A needless install rewrites node_modules (disk I/O on a shared account), and
# a worker that starts mid-install fails with "Cannot find module".
STAMP=node_modules/.installed-lock
PKGS="['dotenv','express','mysql2','multer','pdfkit','bcryptjs','nodemailer','qrcode','adm-zip']"
lock_hash() { cat package.json package-lock.json 2>/dev/null | git hash-object --stdin; }
if [ "$1" = "--install" ] \
  || [ "$(cat "$STAMP" 2>/dev/null)" != "$(lock_hash)" ] \
  || ! node -e "for (const m of $PKGS) require(m)" 2>/dev/null; then
  echo "==> npm install"
  if npm install --no-audit --no-fund; then lock_hash > "$STAMP"
  else echo "FATAL: npm install failed. It runs again on the next deploy."; exit 1; fi
fi
node -e "for (const m of $PKGS) require(m)" || {
  echo "FATAL: packages are missing. The new code is already on disk, so the app"
  echo "fails on its next start until this works: sh deploy.sh --install"
  exit 1
}

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
