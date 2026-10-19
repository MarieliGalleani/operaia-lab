# Somente leitura: saude, logs e missoes (autorizado pela Marieli; sem tabela users)
D="sudo docker"
echo "== api container"; $D inspect operaia-lab-api --format 'img={{.Config.Image}} created={{.Created}} restarts={{.RestartCount}} net={{.HostConfig.NetworkMode}} ports={{json .NetworkSettings.Ports}}'
echo "== api logs 24h: linhas com error = $($D logs --since 24h operaia-lab-api 2>&1 | grep -ciE 'error|fatal')"
$D logs --since 24h operaia-lab-api 2>&1 | grep -iE 'error|fatal' | sed -E 's/"(token|password|secret|key|authorization)":"[^"]*"/"\1":"***"/Ig' | cut -c1-220 | sort | uniq -c | sort -rn | head -8
echo "== api logs (ultimas linhas)"; $D logs --tail 10 operaia-lab-api 2>&1 | cut -c1-220
echo "== health http"
curl -s -m 8 -o /dev/null -w "api.operaia.com.br/api/v1/health -> %{http_code}\n" https://api.operaia.com.br/api/v1/health
curl -s -m 8 -o /dev/null -w "lab.operaia.com.br -> %{http_code}\n" https://lab.operaia.com.br/
curl -s -m 8 https://api.operaia.com.br/api/v1/production-readiness | head -c 600; echo
Q() { $D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" 2>&1; }
echo "== missoes por status"; Q "select status, count(*) from missions group by 1 order by 2 desc"
echo "== por workspace"; Q "select \"workspaceId\", count(*) from missions group by 1 order by 2 desc limit 10"
echo "== criadas por dia (7d)"; Q "select date(\"createdAt\"), count(*) from missions where \"createdAt\" > now()-interval '7 days' group by 1 order by 1"
echo "== heartbeats workers"; Q "select * from worker_heartbeats" | cut -c1-220
echo "== ultimas 8 missoes"; Q "select \"createdAt\", status, \"workspaceId\", \"ownerEmployeeId\", left(coalesce(\"lastError\",''),80) from missions order by \"createdAt\" desc limit 8"
echo "== erros mais comuns (FAILED)"; Q "select left(\"lastError\",100), count(*) from missions where status='FAILED' group by 1 order by 2 desc limit 6"
