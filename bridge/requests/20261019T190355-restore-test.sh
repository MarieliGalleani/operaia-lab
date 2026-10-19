set -u
F=$(sudo ls -t /opt/operaia-lab/shared/backups/*.sql.gz | head -1); echo "arquivo: $F ($(sudo du -h "$F" | cut -f1))"
sudo gzip -t "$F" && echo "GZIP_OK"
sudo zcat "$F" | tail -2
echo "== backups no disco: $(sudo ls /opt/operaia-lab/shared/backups | wc -l) arquivos, $(sudo du -sh /opt/operaia-lab/shared/backups | cut -f1)"
echo "== restore em container descartavel"
sudo docker rm -f pg-restore-test >/dev/null 2>&1
sudo docker run -d --rm --name pg-restore-test -e POSTGRES_PASSWORD=t postgres:16-alpine >/dev/null
for i in $(seq 1 30); do sudo docker exec pg-restore-test pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sudo docker exec pg-restore-test psql -qU postgres -c "CREATE ROLE operaia LOGIN" -c "CREATE DATABASE operaia_lab OWNER operaia"
sudo zcat "$F" | sudo docker exec -i pg-restore-test psql -q -U postgres -d operaia_lab -v ON_ERROR_STOP=0 2> /tmp/restore-err.txt >/dev/null
echo "erros no restore: $(grep -c ERROR /tmp/restore-err.txt)"; head -5 /tmp/restore-err.txt
echo "== contagem de linhas por tabela (restore)"
sudo docker exec pg-restore-test psql -U postgres -d operaia_lab -tAc "select relname, n_live_tup from pg_stat_user_tables order by n_live_tup desc limit 25" 
sudo docker exec pg-restore-test psql -U postgres -d operaia_lab -tAc "analyze" >/dev/null
sudo docker exec pg-restore-test psql -U postgres -d operaia_lab -tAc "select 'missions='||count(*) from missions; select 'mission_events='||count(*) from mission_events; select 'users='||count(*) from users" 2>&1
sudo docker stop pg-restore-test >/dev/null && echo "container descartavel removido"
