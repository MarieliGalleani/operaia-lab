# AUTORIZADO pela Marieli (16:35): recriar operaia-lab-api com token GitHub novo.
# Seguranca: env-file 600 em diretorio privado, apagado com shred; nenhum valor impresso; saida da ponte criptografada.
set -u
[ -n "$APP_GITHUB_TOKEN" ] || { echo "APP_GITHUB_TOKEN vazio"; exit 1; }
D="sudo docker"; C=operaia-lab-api; NET=legacy-net
IMG=$($D inspect $C --format '{{.Image}}')
umask 077; TD=$(mktemp -d); EF="$TD/env"
cleanup() { shred -u "$EF" 2>/dev/null; rm -rf "$TD"; }; trap cleanup EXIT
$D inspect $C --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^$' | grep -vE '^(HOSTNAME|HOME|GITHUB_TOKEN)=' > "$EF"
printf 'GITHUB_TOKEN=%s\n' "$APP_GITHUB_TOKEN" >> "$EF"
echo "env-file: $(wc -l < "$EF") variaveis, permissao $(stat -c %a "$EF")"
if ! { $D stop -t 20 $C >/dev/null && $D network disconnect -f $NET $C && $D rename $C ${C}-old; }; then
  echo "falhou ao preparar; religando o antigo"; $D network connect $NET $C 2>/dev/null; $D start $C >/dev/null; exit 1
fi
echo "antigo parado e guardado como ${C}-old"
$D run -d --name $C --restart always --network $NET -p 127.0.0.1:3333:3333 \
  -v /opt/operaia-lab/shared:/opt/operaia-lab/shared -w /app --env-file "$EF" "$IMG" pnpm --filter @operaia/api start >/dev/null && echo "novo iniciado"
cleanup; echo "env-file temporario apagado: $( [ -e "$EF" ] && echo NAO || echo sim)"
ok=0; for i in $(seq 1 45); do c=$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/health); [ "$c" = 200 ] && { ok=1; break; }; sleep 2; done
if [ $ok = 1 ]; then
  echo "HEALTH_OK local apos ~$((i*2))s"
  curl -s -m 8 -o /dev/null -w "publico api.operaia.com.br/health -> %{http_code}\n" https://api.operaia.com.br/health
  curl -s -m 8 -o /dev/null -w "lab.operaia.com.br -> %{http_code}\n" https://lab.operaia.com.br/
  $D update --restart=no ${C}-old >/dev/null; echo "antigo mantido parado (rollback disponivel)"
  sleep 75; echo "== scanner GitHub:"; $D logs --since 80s $C 2>&1 | grep GITHUB_REPOS_SCANNED | tail -1 | cut -c1-200
  echo "== linhas de erro desde o boot: $($D logs $C 2>&1 | grep -ciE '"level":"?(error|50)')"
else
  echo "FALHOU — rollback"; $D logs --tail 20 $C 2>&1 | cut -c1-160
  $D rm -f $C >/dev/null; $D rename ${C}-old $C; $D network connect $NET $C; $D start $C >/dev/null && echo "rollback feito"
fi
