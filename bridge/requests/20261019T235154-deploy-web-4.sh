# Publicacao autorizada — ajuste de enquadramento do 3D (so o site).
set -eu
W=/opt/operaia-lab-releases/interface-3
cd "$W" && git fetch -q origin claude/interface-3 && git checkout -q --detach FETCH_HEAD && echo "build de $(git log --oneline -1)"
VITE_API_URL=https://api.operaia.com.br/api/v1 pnpm --filter @operaia/web exec vite build > /tmp/w-build.log 2>&1 || { tail -20 /tmp/w-build.log; exit 1; }
LIVE=/opt/operaia-lab/apps/web/dist; BK=/opt/operaia-lab-releases/web-dist-before-$(date -u +%Y%m%dT%H%M%S)
cp -a "$LIVE" "$BK"; rsync -a --delete "$W/apps/web/dist/" "$LIVE/"; sleep 2
code=$(curl -s -o /tmp/idx.html -w '%{http_code}' https://lab.operaia.com.br/); js=$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' /tmp/idx.html | head -1)
jscode=$(curl -s -o /dev/null -w '%{http_code}' "https://lab.operaia.com.br$js"); echo "index=$code js=$jscode"
if [ "$code" != 200 ] || [ "$jscode" != 200 ]; then rsync -a --delete "$BK/" "$LIVE/"; echo ROLLBACK; fi
