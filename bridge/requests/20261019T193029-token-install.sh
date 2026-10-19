# Instala o token novo: recria operaia-lab-api com env identica + GITHUB_TOKEN novo. Rollback automatico.
set -u
[ -n "$APP_GITHUB_TOKEN" ] || { echo "APP_GITHUB_TOKEN vazio"; exit 1; }
D="sudo docker"; C=operaia-lab-api
IMG=$($D inspect $C --format '{{.Image}}')
NET=$($D inspect $C --format '{{.HostConfig.NetworkMode}}')
USR=$($D inspect $C --format '{{.Config.User}}')
EXTRA=$($D inspect $C --format '{{json .HostConfig.ExtraHosts}} {{.HostConfig.LogConfig.Type}}')
ALIASES=$($D inspect $C --format "{{json (index .NetworkSettings.Networks \"$NET\").Aliases}}")
echo "img=${IMG:7:12} net=$NET user='$USR' extra=$EXTRA aliases=$ALIASES"
umask 077; EF=$(mktemp)
$D inspect $C --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^$' | grep -vE '^(HOSTNAME|HOME)=' | grep -v '^GITHUB_TOKEN=' > "$EF"
printf 'GITHUB_TOKEN=%s\n' "$APP_GITHUB_TOKEN" >> "$EF"
echo "vars no env-file: $(wc -l < "$EF")"
$D rename $C ${C}-old && $D stop -t 20 ${C}-old >/dev/null && echo "antigo parado"
$D run -d --name $C --restart always --network "$NET" -p 127.0.0.1:3333:3333 \
  -v /opt/operaia-lab/shared:/opt/operaia-lab/shared -w /app --env-file "$EF" \
  ${USR:+--user "$USR"} "$IMG" pnpm --filter @operaia/api start >/dev/null && echo "novo iniciado"
rm -f "$EF"
ok=0; for i in $(seq 1 45); do c=$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/health); [ "$c" = 200 ] && { ok=1; break; }; sleep 2; done
if [ $ok = 1 ]; then
  echo "HEALTH_OK local"
  curl -s -m 8 -o /dev/null -w "publico api.operaia.com.br/health -> %{http_code}\n" https://api.operaia.com.br/health
  sudo sed -i "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$APP_GITHUB_TOKEN|" /opt/operaia-lab/.env && echo ".env atualizado"
  sleep 70; echo "== scanner GitHub:"; $D logs --since 75s $C 2>&1 | grep GITHUB_REPOS_SCANNED | tail -1 | cut -c1-220
  echo "== erros no boot:"; $D logs $C 2>&1 | grep -ciE '"level":"?(error|50)'
else
  echo "FALHOU — rollback"; $D logs --tail 30 $C 2>&1 | cut -c1-200
  $D rm -f $C; $D rename ${C}-old $C; $D start $C && echo "rollback feito"
fi
