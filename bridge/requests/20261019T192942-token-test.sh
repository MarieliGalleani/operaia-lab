# Testa o token novo (nao altera nada)
[ -n "$APP_GITHUB_TOKEN" ] || { echo "APP_GITHUB_TOKEN vazio"; exit 1; }
curl -s -o /dev/null -w "/user -> %{http_code}\n" -H "Authorization: Bearer $APP_GITHUB_TOKEN" https://api.github.com/user
for r in operaia-lab operaia-core-nexo operaia-infra operaia-deploy flowgrid hexalife odontoclinic estocai; do curl -s -o /dev/null -w "$r -> %{http_code}\n" -H "Authorization: Bearer $APP_GITHUB_TOKEN" https://api.github.com/repos/marieligalleani/$r; done
