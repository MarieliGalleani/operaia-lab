# AUTORIZADO (21:15, teste ponta a ponta): publicar a correcao da Nova demanda (API + site), com rollback.
set -u
W=/opt/operaia-lab-releases/interface-3; D="sudo docker"; C=operaia-lab-api; TS=$(date -u +%Y%m%dT%H%M%S); PREV=${C}-prev-$TS
cd "$W" && git fetch -q origin claude/interface-3 && git checkout -q --detach FETCH_HEAD && echo "codigo: $(git log --oneline -1)"
pnpm install --frozen-lockfile > /tmp/a-install.log 2>&1 || { tail -20 /tmp/a-install.log; exit 1; }
VITE_API_URL=https://api.operaia.com.br/api/v1 pnpm --filter @operaia/web exec vite build > /tmp/w-build.log 2>&1 || { tail -20 /tmp/w-build.log; exit 1; }
$D build -q -t operaia-lab-api:interface3b . > /tmp/a-docker.log 2>&1 || { tail -20 /tmp/a-docker.log; exit 1; }
echo "imagem ok"
NETS=$($D inspect $C --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')
umask 077; TD=$(mktemp -d); EF="$TD/env"; trap 'shred -u "$EF" 2>/dev/null; rm -rf "$TD"' EXIT
$D inspect $C --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^$' | grep -vE '^(HOSTNAME|HOME)=' > "$EF"
$D stop -t 20 $C >/dev/null; for n in $NETS; do $D network disconnect -f "$n" $C; done
$D rename $C $PREV && $D update --restart=no $PREV >/dev/null
first=1; for n in $NETS; do if [ $first = 1 ]; then $D run -d --name $C --restart always --network "$n" -p 127.0.0.1:3333:3333 -v /opt/operaia-lab/shared:/opt/operaia-lab/shared -w /app --env-file "$EF" operaia-lab-api:interface3b pnpm --filter @operaia/api start >/dev/null; first=0; else $D network connect "$n" $C; fi; done
ok=0; for i in $(seq 1 60); do [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/health)" = 200 ] && { ok=1; break; }; sleep 2; done
echo "health_ok=$ok"
if [ $ok = 1 ]; then
  LIVE=/opt/operaia-lab/apps/web/dist; cp -a "$LIVE" /opt/operaia-lab-releases/web-dist-before-$TS; rsync -a --delete "$W/apps/web/dist/" "$LIVE/"
  echo "site -> $(curl -s -o /dev/null -w '%{http_code}' https://lab.operaia.com.br/) api -> $(curl -s -o /dev/null -w '%{http_code}' https://api.operaia.com.br/health)"
  # limpa containers antigos parados (mantem so o ultimo anterior)
  for old in $($D ps -a --format '{{.Names}}' | grep -E "^${C}-(old|prev-)" | grep -v "$PREV"); do $D rm "$old" >/dev/null && echo "removido $old"; done
else
  echo "FALHOU — rollback"; $D logs --tail 20 $C 2>&1 | cut -c1-200
  $D rm -f $C >/dev/null; $D rename $PREV $C; for n in $NETS; do $D network connect "$n" $C; done; $D update --restart=always $C >/dev/null; $D start $C >/dev/null && echo "rollback feito"
fi
