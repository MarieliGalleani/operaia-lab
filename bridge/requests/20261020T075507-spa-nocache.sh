# Garante que celulares recebam a versao nova: index.html sem cache, /assets com cache longo (arquivos com hash).
set -u
F=/home/ubuntu/static-sites/spa.conf; BK=$F.bak-$(date -u +%Y%m%dT%H%M%S); cp -p $F $BK
cat > $F <<'CONF'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
        # index.html (e rotas do app) sempre revalidam: versao nova chega na hora.
        add_header Cache-Control "no-cache";
    }
    location /assets/ {
        # nomes com hash: podem ficar em cache por 1 ano.
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
    location = /manifest.webmanifest {
        add_header Cache-Control "no-cache";
    }
}
CONF
ok=1
for c in $(sudo docker ps --format '{{.Names}}' | grep -E 'web-static$'); do
  if sudo docker exec $c nginx -t >/dev/null 2>&1; then sudo docker exec $c nginx -s reload && echo "$c recarregado"; else ok=0; echo "$c: config invalida"; fi
done
if [ $ok = 0 ]; then cp -p $BK $F; for c in $(sudo docker ps --format '{{.Names}}' | grep -E 'web-static$'); do sudo docker exec $c nginx -s reload; done; echo ROLLBACK; fi
sleep 1
curl -sI https://lab.operaia.com.br/app/floor/dev/office | grep -iE "cache-control|^HTTP"
js=$(curl -s https://lab.operaia.com.br/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1); curl -sI "https://lab.operaia.com.br$js" | grep -iE "cache-control|^HTTP"
