# AUTORIZADO (21:15): regra de revisao do CEO passa de 30 min para 1x/dia (proxima 20/10 09:00 BRT).
set -eu
Q() { sudo docker exec -i operaia-lab-postgres psql -U operaia -d operaia_lab -v ON_ERROR_STOP=1 "$@"; }
echo "== antes"; Q -tAc "select id, \"workspaceId\", \"intervalSec\", enabled, \"lastEnqueuedAt\" from schedule_rules"
Q -tAc "update schedule_rules set \"intervalSec\"=86400, \"lastEnqueuedAt\"='2026-10-19 12:00:00+00', \"updatedAt\"=now() where enabled = true and \"intervalSec\" < 86400 returning id"
echo "== depois"; Q -tAc "select id, \"workspaceId\", \"intervalSec\", enabled, \"lastEnqueuedAt\" from schedule_rules"
