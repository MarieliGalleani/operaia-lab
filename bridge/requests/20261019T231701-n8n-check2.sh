# Somente leitura
D="sudo docker"
echo "path: $($D exec operaia-lab-api sh -c 'echo $N8N_API_URL' | sed -E 's#https?://[^/]+##')"
$D exec operaia-lab-api sh -c 'node -e "fetch(\"http://n8n:5678/healthz\").then(r=>console.log(\"n8n:5678/healthz ->\",r.status)).catch(e=>console.log(\"erro\",e.message))"'
echo "== ultimo build da imagem da API: $($D image inspect operaia-lab-api:latest --format '{{.Created}}')"
grep -rn "operaia-lab-api" /home/ubuntu/operaia-host/*.md /home/ubuntu/operaia-host/README* 2>/dev/null | head -3; ls /home/ubuntu/operaia-host | head -20
