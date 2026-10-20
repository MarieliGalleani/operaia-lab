# Somente leitura: repos do GitHub (token do escritorio) x projetos/bindings no banco
echo "== repos GitHub"
for page in 1 2; do
curl -s -H "Authorization: Bearer $APP_GITHUB_TOKEN" "https://api.github.com/user/repos?per_page=100&page=$page&affiliation=owner,collaborator,organization_member&sort=pushed" \
 | python3 -c 'import json,sys
for r in json.load(sys.stdin): print("\t".join([r["full_name"], "priv" if r["private"] else "pub", "arch" if r["archived"] else "-", "fork" if r["fork"] else "-", (r["pushed_at"] or "")[:10], r["language"] or "-", (r["description"] or "")[:70]]))'
done
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
echo "== projects"; Q "select id, name, status, left(coalesce(objective,''),60) from projects order by name"
echo "== bindings"; Q "select \"workspaceId\", \"externalRef\", enabled from workspace_source_bindings order by 1"
echo "== tasks por projeto"; Q "select \"projectId\", count(*) from tasks group by 1"
