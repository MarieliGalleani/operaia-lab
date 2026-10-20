# Somente leitura
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
M=b07b06fd-922f-4d86-b9f8-9e487108db06
Q "select string_agg(column_name, ',') from information_schema.columns where table_name='mission_events'"
Q "select left(\"resultJson\"::text, 3000) from missions where id='$M'"
