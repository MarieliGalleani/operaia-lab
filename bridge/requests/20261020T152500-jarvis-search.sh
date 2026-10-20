H="Authorization: Bearer $APP_GITHUB_TOKEN"
echo "== repos com jarvis no nome/descrição"
curl -s -H "$H" "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member" | python3 -c 'import sys,json; [print(r["full_name"],"|",r.get("description") or "") for r in json.load(sys.stdin) if "jarvis" in (r["name"]+" "+(r.get("description") or "")).lower()]'
echo "== codigo com jarvis"
curl -s -H "$H" -H "Accept: application/vnd.github+json" "https://api.github.com/search/code?q=jarvis+user:MarieliGalleani&per_page=50" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("total",d.get("total_count"), d.get("message","")); [print(i["repository"]["full_name"],"→",i["path"]) for i in d.get("items",[])]'
