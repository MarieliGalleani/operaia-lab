# Somente leitura: redes dos containers (diagnostico do erro do N8N)
D="sudo docker"
echo "== api antiga (parada): $($D inspect operaia-lab-api-old --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
echo "== api nova: $($D inspect operaia-lab-api --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
echo "== n8n: $($D inspect n8n --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}({{join $v.Aliases ","}}) {{end}}')"
echo "== quem se chama site-operaia-1789678503139:"; $D ps -a --format '{{.Names}}' | grep -i site-operaia || echo "nenhum container com esse nome"
$D service ls 2>/dev/null | grep -i "site-operaia\|n8n" | head
echo "== URL configurada (so host): $($D exec operaia-lab-api sh -c 'echo $N8N_API_URL' | sed -E 's#(https?://[^/]+).*#\1#')"
echo "== api alcanca n8n:5678? $($D exec operaia-lab-api sh -c 'node -e "fetch(\"http://n8n:5678/healthz\").then(r=>console.log(r.status)).catch(e=>console.log(\"erro\",e.cause&&e.cause.code))"')"
