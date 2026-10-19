# Somente leitura: detalhes de missoes, logs e versao em producao
D="sudo docker"
Q() { $D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" 2>&1; }
echo "== colunas missions"; Q "select string_agg(column_name, ',') from information_schema.columns where table_name='missions'"
echo "== missoes recentes operaia-lab: tipo/origem/objetivo"; Q "select \"missionKind\", origin, \"missionType\", left(objective,90), count(*) from missions where \"workspaceId\"='operaia-lab' and \"createdAt\">now()-interval '2 days' group by 1,2,3,4 order by 5 desc limit 8"
echo "== missoes com especialista (owner != ceo)"; Q "select \"ownerEmployeeId\", status, count(*) from missions group by 1,2 order by 3 desc limit 12"
echo "== erro detalhado do scanner GitHub (logs)"; $D logs --since 2h operaia-lab-api 2>&1 | grep -iE 'github' | grep -viE 'GITHUB_REPOS_SCANNED' | sed -E 's/(gh[pousr]_[A-Za-z0-9]{6})[A-Za-z0-9]+/\1***/g' | cut -c1-260 | sort | uniq -c | sort -rn | head -6
echo "== versao do codigo no container"; $D exec operaia-lab-api sh -c 'ls /app 2>/dev/null | head; cat /app/.git-sha /app/BUILD_SHA 2>/dev/null' ; $D image inspect operaia-lab-api:latest --format '{{json .Config.Labels}}'
echo "== lab-web-static"; $D inspect lab-web-static --format 'mounts={{json .Mounts}}' | cut -c1-400
echo "== como a api foi construida"; ls /opt/operaia-lab/apps/api/Dockerfile /opt/operaia-lab/Dockerfile* /opt/operaia-lab/infra/production 2>&1 | head; grep -rl "operaia-lab-api" /opt/operaia-lab/infra /opt/operaia-lab/deploy /home/ubuntu/operaia-deploy 2>/dev/null | head
echo "== git na VM vs origin"; cd /opt/operaia-lab && sudo -u ubuntu git fetch -q origin lab 2>&1 | tail -1; git rev-parse --short HEAD origin/lab 2>&1; git log --oneline --since=2026-09-22 | wc -l
