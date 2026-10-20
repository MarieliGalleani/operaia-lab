# AUTORIZADO (23:34): juntar na lab + equipe inteira no Claude. Com backup do .env e rollback do container.
set -u
D="sudo docker"; C=operaia-lab-api; TS=$(date -u +%Y%m%dT%H%M%S); PREV=${C}-prev-$TS
echo "== repo da VM -> lab"
cd /opt/operaia-lab && git fetch -q origin lab && git merge --ff-only -q origin/lab && echo "VM em $(git log --oneline -1)"
echo "== .env (backup + LLM)"
sudo cp -p .env /opt/operaia-lab-releases/env-backup-$TS && sudo chmod 600 /opt/operaia-lab-releases/env-backup-$TS
setv() { if sudo grep -q "^$1=" .env; then sudo sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" | sudo tee -a .env >/dev/null; fi; }
setv LLM_PROVIDER anthropic; setv LLM_MODEL claude-sonnet-5-5; setv LLM_FALLBACK_PROVIDERS gemini,deterministic
sudo grep -E '^LLM_(PROVIDER|MODEL|FALLBACK_PROVIDERS)=' .env
echo "== imagem"
W=/opt/operaia-lab-releases/interface-3
cd "$W" && git fetch -q origin lab && git checkout -q --detach FETCH_HEAD && echo "build de $(git log --oneline -1)"
pnpm install --frozen-lockfile > /tmp/a-install.log 2>&1 || { tail -20 /tmp/a-install.log; exit 1; }
$D build -q -t operaia-lab-api:lab-$TS . > /tmp/a-docker.log 2>&1 || { tail -20 /tmp/a-docker.log; exit 1; }
NETS=$($D inspect $C --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')
umask 077; TD=$(mktemp -d); EF="$TD/env"; trap 'shred -u "$EF" 2>/dev/null; rm -rf "$TD"' EXIT
$D inspect $C --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^$' | grep -vE '^(HOSTNAME|HOME|LLM_PROVIDER|LLM_MODEL|LLM_FALLBACK_PROVIDERS)=' > "$EF"
printf 'LLM_PROVIDER=anthropic\nLLM_MODEL=claude-sonnet-5-5\nLLM_FALLBACK_PROVIDERS=gemini,deterministic\n' >> "$EF"
$D stop -t 20 $C >/dev/null; for n in $NETS; do $D network disconnect -f "$n" $C; done
$D rename $C $PREV && $D update --restart=no $PREV >/dev/null
first=1; for n in $NETS; do if [ $first = 1 ]; then $D run -d --name $C --restart always --network "$n" -p 127.0.0.1:3333:3333 -v /opt/operaia-lab/shared:/opt/operaia-lab/shared -w /app --env-file "$EF" operaia-lab-api:lab-$TS pnpm --filter @operaia/api start >/dev/null; first=0; else $D network connect "$n" $C; fi; done
ok=0; for i in $(seq 1 60); do [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/health)" = 200 ] && { ok=1; break; }; sleep 2; done
echo "health_ok=$ok"
if [ $ok = 1 ]; then
  $D logs $C 2>&1 | grep '\[llm\] stack' | cut -c1-200
  echo "api publica -> $(curl -s -o /dev/null -w '%{http_code}' https://api.operaia.com.br/health)"
  for old in $($D ps -a --format '{{.Names}}' | grep -E "^${C}-prev-" | grep -v "$PREV"); do $D rm "$old" >/dev/null && echo "removido $old"; done
  for img in interface3d; do $D rmi operaia-lab-api:$img >/dev/null 2>&1 && echo "imagem $img removida" || true; done
  $D tag operaia-lab-api:lab-$TS operaia-lab-api:latest && echo "operaia-lab-api:latest -> lab-$TS"
else
  echo "FALHOU — rollback"; $D logs --tail 20 $C 2>&1 | cut -c1-200
  $D rm -f $C >/dev/null; $D rename $PREV $C; for n in $NETS; do $D network connect "$n" $C; done; $D update --restart=always $C >/dev/null; $D start $C >/dev/null && echo "rollback feito"
fi
