# Somente leitura
D="sudo docker"
Q() { $D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" 2>&1; }
echo "== missoes recentes operaia-lab"; Q "select \"missionKind\", origin, left(objective,110), count(*) from missions where \"workspaceId\"='operaia-lab' and \"createdAt\">now()-interval '2 days' group by 1,2,3 order by 4 desc limit 6"
echo "== resultado de uma recente"; Q "select left(\"resultJson\"::text, 600) from missions where \"workspaceId\"='operaia-lab' order by \"createdAt\" desc limit 1"
echo "== scanner github: evento com erro"; $D logs --since 30m operaia-lab-api 2>&1 | grep -iE 'github|repo' | grep -v GITHUB_REPOS_SCANNED | cut -c1-300 | sed -E 's/(gh[pousr]_[A-Za-z0-9]{4})[A-Za-z0-9_]+/\1***/g' | sort | uniq -c | sort -rn | head -6
echo "== bindings github"; Q "select \"workspaceId\", left(coalesce(\"lastError\",''),120) from workspace_source_bindings" 2>&1 | head -10
Q "select string_agg(column_name, ',') from information_schema.columns where table_name='workspace_source_bindings'"
echo "== env (so nomes de variaveis github/llm)"; $D exec operaia-lab-api sh -c 'env | cut -d= -f1 | grep -iE "github|llm|gemini|openai|anthropic|openrouter|node_env"'
echo "== llm provider"; $D exec operaia-lab-api sh -c 'echo LLM_PROVIDER=$LLM_PROVIDER LLM_MODEL=$LLM_MODEL'
echo "== commits na VM desde o build da imagem (22/09)"; cd /opt/operaia-lab && git log --oneline --since=2026-09-22 | head -10
echo "== quem sobe o container"; $D inspect operaia-lab-api --format '{{index .Config.Labels "com.docker.compose.project"}} {{.HostConfig.RestartPolicy.Name}} {{json .Config.Cmd}}'
