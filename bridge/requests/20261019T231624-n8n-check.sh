# Somente leitura: rede do n8n x API
D="sudo docker"
echo "== redes do api-old: $($D inspect operaia-lab-api-old --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
echo "== redes do api novo: $($D inspect operaia-lab-api --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
echo "== redes do n8n: $($D inspect n8n --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}({{join .Aliases ","}}) {{end}}')"
echo "== containers/servicos com nome site-operaia*:"; $D ps -a --format '{{.Names}}' | grep -i site-operaia; $D service ls 2>/dev/null | grep -i operaia | cut -c1-120
echo "== N8N_API_URL host: $($D exec operaia-lab-api sh -c 'echo $N8N_API_URL' | sed -E 's#(https?://[^/]+).*#\1#')"
echo "== N8N_EDITOR_URL: $($D exec operaia-lab-api sh -c 'echo $N8N_EDITOR_URL')"
$D exec operaia-lab-api sh -c 'getent hosts n8n site-operaia-1789678503139 2>&1' 
