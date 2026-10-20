# Somente leitura: estado da demanda de teste
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
Q "select id, status, risk, \"missionId\", \"workspaceId\", \"createdAt\" from office_demands order by \"createdAt\" desc limit 3"
Q "select count(*) from office_approval_requests"
Q "select id, decision, reason from work_governance_decisions order by \"createdAt\" desc limit 3" 2>&1 | cut -c1-300
Q "select string_agg(column_name, ',') from information_schema.columns where table_name='work_governance_decisions'"
