# AUTORIZADO (Marieli): publicar API + site novos. Passo 2/2: troca com rollback automatico.
# Seguranca: env-file 600 em dir privado, apagado com shred; nenhum valor impresso.
set -u
D="sudo docker"; C=operaia-lab-api; TS=$(date -u +%Y%m%dT%H%M%S); PREV=${C}-prev-$TS
NETS=$($D inspect $C --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')
OLDIMG=$($D inspect $C --format '{{.Image}}')
echo "redes: $NETS"
umask 077; TD=$(mktemp -d); EF="$TD/env"; trap 'shred -u "$EF" 2>/dev/null; rm -rf "$TD"' EXIT
$D inspect $C --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^$' | grep -vE '^(HOSTNAME|HOME|N8N_API_URL)=' > "$EF"
cp "$EF" "$TD/env.old"; $D inspect $C --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^N8N_API_URL=' >> "$TD/env.old"
echo 'N8N_API_URL=http://n8n:5678/api/v1' >> "$EF"
run_new() { # $1 imagem $2 envfile
  local first=1
  for n in $NETS; do
    if [ $first = 1 ]; then $D run -d --name $C --restart always --network "$n" -p 127.0.0.1:3333:3333 \
        -v /opt/operaia-lab/shared:/opt/operaia-lab/shared -w /app --env-file "$2" "$1" pnpm --filter @operaia/api start >/dev/null; first=0
    else $D network connect "$n" $C; fi
  done
}
$D stop -t 20 $C >/dev/null
for n in $NETS; do $D network disconnect -f "$n" $C; done
$D rename $C $PREV && $D update --restart=no $PREV >/dev/null && echo "anterior guardado: $PREV"
run_new operaia-lab-api:interface3 "$EF"
ok=0; for i in $(seq 1 60); do [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/health)" = 200 ] && { ok=1; break; }; sleep 2; done
sig=$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/api/v1/signals)
sf=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3333/api/v1/store-flow/runs)
echo "health_ok=$ok apos ~$((i*2))s | /signals=$sig /store-flow/runs=$sf (401 = rota existe e exige login)"
if [ $ok = 1 ] && [ "$sig" = 401 ]; then
  $D exec $C sh -c 'node -e "fetch(process.env.N8N_API_URL+\"/workflows?limit=1\",{headers:{\"X-N8N-API-KEY\":process.env.N8N_API_KEY}}).then(r=>console.log(\"n8n api ->\",r.status)).catch(e=>console.log(\"n8n erro\",e.message))"'
  curl -s -m 8 -o /dev/null -w "publico api /health -> %{http_code}\n" https://api.operaia.com.br/health
  # site
  LIVE=/opt/operaia-lab/apps/web/dist; BK=/opt/operaia-lab-releases/web-dist-before-$TS
  cp -a "$LIVE" "$BK" && rsync -a --delete /opt/operaia-lab-releases/interface-3/apps/web/dist/ "$LIVE/" && echo "site trocado (backup $BK)"
  sleep 2; echo "site -> $(curl -s -o /dev/null -w '%{http_code}' https://lab.operaia.com.br/)"
  sleep 60; echo "== supervisor: $($D logs --since 65s $C 2>&1 | grep -c SUPERVISOR_CYCLE) ciclos; erros: $($D logs $C 2>&1 | grep -ciE '"level":"?(error|50)')"
  $D logs --since 65s $C 2>&1 | grep GITHUB_REPOS_SCANNED | tail -1 | cut -c1-200
else
  echo "FALHOU — rollback"; $D logs --tail 25 $C 2>&1 | cut -c1-200
  $D rm -f $C >/dev/null; $D rename $PREV $C
  for n in $NETS; do $D network connect "$n" $C; done
  $D update --restart=always $C >/dev/null; $D start $C >/dev/null && echo "rollback feito (imagem ${OLDIMG:7:12})"
fi
