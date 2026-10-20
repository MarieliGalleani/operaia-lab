# Somente leitura: cabecalhos de cache do site
curl -sI https://lab.operaia.com.br/app/floor/dev/office | grep -iE "cache|etag|last-mod|^age|expires|server"
echo "== spa.conf"; cat /home/ubuntu/static-sites/spa.conf
