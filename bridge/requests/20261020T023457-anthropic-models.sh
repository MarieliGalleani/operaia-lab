# Somente leitura: ids de modelo Claude disponiveis
sudo docker exec operaia-lab-api sh -c 'node -e "
fetch(\"https://api.anthropic.com/v1/models?limit=20\",{headers:{\"x-api-key\":process.env.ANTHROPIC_API_KEY,\"anthropic-version\":\"2023-06-01\"}}).then(r=>r.json()).then(j=>console.log((j.data||[]).map(m=>m.id).join(\" \"))).catch(e=>console.log(\"erro\",e.message))"' < /dev/null
cd /opt/operaia-lab && git status -sb | head -3 && git log --oneline -1
