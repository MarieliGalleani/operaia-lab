# Somente leitura: o que o Mag entregou e o follow-up
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
M=663f2854-f5f8-4a98-b64a-8e4c9b34cca4
E=$(Q "select id from missions where \"parentMissionId\"='$M' and \"missionKind\"='EXECUTE' limit 1")
Q "select left(\"resultJson\"::text, 2500) from missions where id='$E'"
echo; echo "== consolidacao (resumo)"; Q "select left(\"resultJson\"#>>'{final,output,report,summary}', 800) from missions where id='$M'"
echo "== follow-ups depois de 00:38"; Q "select \"missionKind\", status, \"ownerEmployeeId\", left(objective,120), to_char(\"createdAt\",'HH24:MI:SS') from missions where \"createdAt\" > '2026-10-20 00:38:00' and id <> '$M' and coalesce(\"parentMissionId\",'') <> '$M' order by \"createdAt\""
echo "== demanda"; Q "select status from office_demands where \"missionId\"='$M'"
