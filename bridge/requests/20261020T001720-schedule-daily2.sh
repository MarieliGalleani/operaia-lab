# AUTORIZADO (21:15): regra do CEO para 1x/dia. (sem -i: o anterior consumiu o resto do script)
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -v ON_ERROR_STOP=1 -tAc "$1" < /dev/null; }
echo "== antes"; Q "select id, \"workspaceId\", \"intervalSec\", enabled, \"lastEnqueuedAt\" from schedule_rules"
Q "update schedule_rules set \"intervalSec\"=86400, \"lastEnqueuedAt\"='2026-10-19 12:00:00+00', \"updatedAt\"=now() where enabled = true and \"intervalSec\" < 86400 returning id"
echo "== depois"; Q "select id, \"workspaceId\", \"intervalSec\", enabled, \"lastEnqueuedAt\" from schedule_rules"
