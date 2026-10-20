set -e
TS=$(date +%Y%m%dT%H%M%S)
OUT=/opt/operaia-lab-releases/db-backup-before-negocio-$TS.dump
umask 077
docker exec operaia-lab-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d operaia_lab -Fc' > "$OUT"
chmod 600 "$OUT"
echo "arquivo=$OUT tamanho=$(stat -c %s "$OUT")"
docker exec -i operaia-lab-postgres pg_restore --list < "$OUT" | grep -c "TABLE DATA" | sed 's/^/tabelas_com_dados=/'
