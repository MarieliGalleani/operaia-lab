# Somente leitura: acompanhar a demanda de teste
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
M=$(Q "select \"missionId\" from office_demands where \"missionId\" is not null order by \"createdAt\" desc limit 1")
echo "demanda: $(Q "select status from office_demands where \"missionId\"='$M'") missao=$M"
Q "select \"missionKind\", status, \"ownerEmployeeId\", coalesce(\"requiredSpecialization\",''), left(coalesce(\"lastError\",''),120), \"createdAt\" from missions where id='$M' or \"parentMissionId\"='$M' order by \"createdAt\""
echo "== eventos"; Q "select type, left(coalesce(message,\"payloadJson\"::text,''),140) from mission_events where \"missionId\" in (select id from missions where id='$M' or \"parentMissionId\"='$M') order by \"createdAt\" limit 25" 2>&1 | head -30
