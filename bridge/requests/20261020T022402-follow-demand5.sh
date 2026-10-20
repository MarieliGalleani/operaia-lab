# Somente leitura: resultado da demanda com Gemini como reserva
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
M=$(Q "select \"missionId\" from office_demands where \"missionId\" is not null order by \"createdAt\" desc limit 1")
Q "select \"missionKind\", status, \"ownerEmployeeId\", to_char(\"createdAt\",'HH24:MI:SS'), to_char(\"finishedAt\",'HH24:MI:SS') from missions where id='$M' or \"parentMissionId\"='$M' order by \"createdAt\""
E=$(Q "select id from missions where \"parentMissionId\"='$M' and \"missionKind\"='EXECUTE' limit 1")
echo "== ferramentas"; Q "select type, left(message,100) from mission_events where \"missionId\"='$E' and type='tool_used'"
echo "== entrega do Mag"; Q "select jsonb_pretty(jsonb_build_object('summary', \"resultJson\"#>'{delivery,summary}', 'findings', \"resultJson\"#>'{delivery,findings}', 'recommendations', \"resultJson\"#>'{delivery,recommendations}')) from missions where id='$E'"
echo "== resposta final da Opera"; Q "select left(\"resultJson\"#>>'{final,output,decision,decision}', 1800) from missions where id='$M'"
echo "== fallback no log"; sudo docker logs --since 4m operaia-lab-api 2>&1 | grep -ciE 'fallback_used|fallback'
