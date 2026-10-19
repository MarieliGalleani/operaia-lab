# P2 — zerar dados operacionais DEMO (aprovado pela Marieli). Backup: operaia_lab_20261019T192431Z.sql.gz
set -e
D="sudo docker"
$D exec -i operaia-lab-postgres psql -U operaia -d operaia_lab -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
TRUNCATE missions, mission_events, mission_dependencies, mission_learnings,
         operational_memory_notes, domain_signals, coordination_signal_latches,
         workspace_github_snapshots RESTRICT;
COMMIT;
VACUUM (ANALYZE) missions, mission_events, mission_learnings, operational_memory_notes, coordination_signal_latches;
SQL
for t in missions mission_events mission_learnings operational_memory_notes domain_signals coordination_signal_latches projects workspace_source_bindings schedule_rules users; do echo "$t=$($D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "select count(*) from $t")"; done
echo "tamanho do banco: $($D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "select pg_size_pretty(pg_database_size('operaia_lab'))")"
sleep 65; echo "== supervisor depois da limpeza"; $D logs --since 70s operaia-lab-api 2>&1 | grep -E 'SUPERVISOR_CYCLE|health_snapshot|"level":"error"|"level":50' | cut -c1-200 | tail -4
