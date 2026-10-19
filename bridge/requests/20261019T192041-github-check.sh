# Somente leitura: por que o scanner GitHub falha (8/8)
D="sudo docker"
Q() { $D exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" 2>&1; }
echo "== bindings"; Q "select \"workspaceId\", \"sourceType\", \"externalRef\", enabled, \"secretRef\" from workspace_source_bindings"
echo "== token: valido?"; $D exec operaia-lab-api sh -c 'node -e "
fetch(\"https://api.github.com/user\",{headers:{authorization:\"Bearer \"+process.env.GITHUB_TOKEN,\"user-agent\":\"operaia\"}}).then(async r=>{console.log(\"/user ->\",r.status, r.headers.get(\"x-oauth-scopes\")); const j=await r.json().catch(()=>({})); console.log(\"login:\", j.login||j.message)})
.then(()=>fetch(\"https://api.github.com/repos/MarieliGalleani/operaia-lab\",{headers:{authorization:\"Bearer \"+process.env.GITHUB_TOKEN,\"user-agent\":\"operaia\"}})).then(r=>console.log(\"repo operaia-lab ->\",r.status))
.catch(e=>console.log(\"fetch erro:\", e.message))"'
