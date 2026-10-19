# Correcao de regressao da recriacao da API (autorizada 16:35): o container antigo estava
# tambem na rede operaia-host-net (onde vive o N8N do operaia-host). Religa a API nova nela.
D="sudo docker"
$D network connect operaia-host-net operaia-lab-api && echo "conectado a operaia-host-net"
echo "redes agora: $($D inspect operaia-lab-api --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
echo "resolve o host do N8N? $($D exec operaia-lab-api sh -c 'node -e "require(\"dns\").lookup(\"site-operaia-1789678503139\",(e,a)=>console.log(e?\"nao: \"+e.code:\"sim \"+a))"')"
sleep 2
echo "rota external-automations: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/api/v1/office/external-automations)"
$D logs --since 20s operaia-lab-api 2>&1 | grep -c '"statusCode":500' | sed 's/^/500s ultimos 20s: /'
