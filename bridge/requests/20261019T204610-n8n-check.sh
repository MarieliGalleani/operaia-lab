# Somente leitura: onde esta o N8N que a API deveria usar
D="sudo docker"
echo "== containers na operaia-host-net:"; $D network inspect operaia-host-net --format '{{range .Containers}}{{.Name}} {{end}}'
echo "== quem escuta 18150:"; sudo ss -ltnp | grep 18150 || echo "ninguem"
echo "== historico: o nome existia? (logs da API antiga)"; $D logs operaia-lab-api-old 2>&1 | grep -c "ENOTFOUND site-operaia-1789678503139" | sed 's/^/erros ENOTFOUND na API antiga: /'
$D logs operaia-lab-api-old 2>&1 | grep 'external-automations' | grep -oE '"statusCode":[0-9]+' | sort | uniq -c
echo "== chave atual funciona no n8n:5678?"
$D exec operaia-lab-api sh -c 'node -e "fetch(\"http://n8n:5678/api/v1/workflows?limit=1\",{headers:{\"X-N8N-API-KEY\":process.env.N8N_API_KEY||\"\"}}).then(r=>console.log(\"status\",r.status)).catch(e=>console.log(\"erro\",e.message))"'
echo "N8N_EDITOR_URL host: $($D exec operaia-lab-api sh -c 'echo $N8N_EDITOR_URL' | sed -E 's#(https?://[^/]+).*#\1#')"
