# Somente leitura: resultado da demanda com especialistas novos
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
M=$(Q "select \"missionId\" from office_demands where \"missionId\" is not null order by \"createdAt\" desc limit 1")
echo "missao=$M"
Q "select \"missionKind\", status, \"ownerEmployeeId\", to_char(\"createdAt\",'HH24:MI:SS'), to_char(\"finishedAt\",'HH24:MI:SS'), left(coalesce(\"lastError\",''),160) from missions where id='$M' or \"parentMissionId\"='$M' order by \"createdAt\""
E=$(Q "select id from missions where \"parentMissionId\"='$M' and \"missionKind\"='EXECUTE' limit 1")
echo "== ferramentas"; Q "select type, left(message,120) from mission_events where \"missionId\"='$E' order by \"createdAt\""
echo "== entrega do especialista"; Q "select jsonb_pretty(jsonb_build_object('summary', \"resultJson\"#>'{delivery,summary}', 'findings', \"resultJson\"#>'{delivery,findings}', 'recommendations', \"resultJson\"#>'{delivery,recommendations}')) from missions where id='$E'"
echo "== resposta final da Opera"; Q "select left(\"resultJson\"#>>'{final,output,decision,decision}', 1500) from missions where id='$M'"
echo "== follow-ups extras desde 02:13"; Q "select count(*) from missions where \"createdAt\" > '2026-10-20 02:13:00' and objective like '%FOLLOW_UP_DELEGATE%'"
