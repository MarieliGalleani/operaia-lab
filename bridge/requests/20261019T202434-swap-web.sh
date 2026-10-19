# AUTORIZADO (17:23): publicar Interface 3.0. Passo 2/2: troca do site com backup e rollback.
set -eu
LIVE=/opt/operaia-lab/apps/web/dist
NEW=/opt/operaia-lab-releases/interface-3/apps/web/dist
BK=/opt/operaia-lab-releases/web-dist-before-interface3-$(date -u +%Y%m%dT%H%M%S)
cp -a "$LIVE" "$BK" && echo "backup: $BK ($(du -sh $BK | cut -f1))"
rsync -a --delete "$NEW/" "$LIVE/" && echo "site trocado"
sleep 2
code=$(curl -s -o /tmp/idx.html -w '%{http_code}' https://lab.operaia.com.br/)
js=$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' /tmp/idx.html | head -1)
jscode=$(curl -s -o /dev/null -w '%{http_code}' "https://lab.operaia.com.br$js")
deep=$(curl -s -o /dev/null -w '%{http_code}' https://lab.operaia.com.br/app/floor/dev/office)
echo "index=$code js=$jscode ($js) rota-3d=$deep"
if [ "$code" != 200 ] || [ "$jscode" != 200 ]; then
  rsync -a --delete "$BK/" "$LIVE/" && echo "ROLLBACK FEITO"
fi
echo "$BK" > /opt/operaia-lab-releases/LAST_WEB_BACKUP
