# Somente leitura: compara NOMES de variaveis (sem valores) e testa o token do .env
D="sudo docker"
sudo grep -E '^[A-Z_][A-Z0-9_]*=' /opt/operaia-lab/.env | cut -d= -f1 | sort > /tmp/k_env
$D exec operaia-lab-api sh -c 'env' | cut -d= -f1 | sort > /tmp/k_ct
echo "== so no container:"; comm -13 /tmp/k_env /tmp/k_ct | tr '\n' ' '; echo
echo "== so no .env:"; comm -23 /tmp/k_env /tmp/k_ct | tr '\n' ' '; echo
echo "== vars com valor diferente (.env x container):"
for k in $(comm -12 /tmp/k_env /tmp/k_ct); do a=$(sudo grep "^$k=" /opt/operaia-lab/.env | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' | sha256sum | cut -c1-8); b=$($D exec operaia-lab-api sh -c "printf %s \"\$$k\"" | sha256sum | cut -c1-8); [ "$a" != "$b" ] && printf "%s " "$k"; done; echo
echo "== token do .env e valido?"
T=$(sudo grep '^GITHUB_TOKEN=' /opt/operaia-lab/.env | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')
curl -s -o /dev/null -w "/user -> %{http_code}\n" -H "Authorization: Bearer $T" https://api.github.com/user
rm -f /tmp/k_env /tmp/k_ct
