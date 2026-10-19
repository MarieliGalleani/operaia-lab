# P2 preflight (somente leitura + backup novo). Nada e apagado aqui.
D="sudo docker"
Q() { $D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" 2>&1; }
echo "== FKs que apontam para as tabelas a zerar, vindas de fora do conjunto"
Q "select c.conrelid::regclass||' -> '||c.confrelid::regclass from pg_constraint c where c.contype='f' and c.confrelid::regclass::text in ('missions','mission_events','mission_dependencies','mission_learnings','operational_memory_notes','domain_signals','coordination_signal_latches','workspace_github_snapshots') and c.conrelid::regclass::text not in ('missions','mission_events','mission_dependencies','mission_learnings','operational_memory_notes','domain_signals','coordination_signal_latches','workspace_github_snapshots')"
echo "== contagens atuais"
for t in missions mission_events mission_dependencies mission_learnings operational_memory_notes domain_signals coordination_signal_latches workspace_github_snapshots action_executions change_proposals work_governance_decisions office_demands office_approval_requests office_decision_traces tasks; do echo "$t=$(Q "select count(*) from $t")"; done
echo "== backup novo"
sudo systemctl start operaia-backup.service && F=$(sudo ls -t /opt/operaia-lab/shared/backups/*.sql.gz | head -1) && sudo gzip -t "$F" && echo "BACKUP_OK $F $(sudo du -h "$F" | cut -f1)"
