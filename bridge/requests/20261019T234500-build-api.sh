# AUTORIZADO (Marieli): publicar API + site novos. Passo 1/2: build isolado, nada no ar muda.
set -eu
W=/opt/operaia-lab-releases/interface-3
cd "$W" && git fetch -q origin claude/interface-3 && git checkout -q --detach FETCH_HEAD && echo "codigo: $(git log --oneline -1)"
pnpm install --frozen-lockfile > /tmp/a-install.log 2>&1 || { tail -25 /tmp/a-install.log; exit 1; }
pnpm --filter @operaia/database exec prisma generate > /tmp/a-gen.log 2>&1 || { tail -15 /tmp/a-gen.log; exit 1; }
echo "deps + prisma ok"
VITE_API_URL=https://api.operaia.com.br/api/v1 pnpm --filter @operaia/web exec vite build > /tmp/w-build.log 2>&1 || { tail -20 /tmp/w-build.log; exit 1; }
echo "web ok: $(du -sh apps/web/dist | cut -f1)"
sudo docker build -q -t operaia-lab-api:interface3 . > /tmp/a-docker.log 2>&1 || { tail -20 /tmp/a-docker.log; exit 1; }
echo "imagem: $(sudo docker image inspect operaia-lab-api:interface3 --format '{{.Id}} {{.Size}}' | cut -c8-19) $(( $(sudo docker image inspect operaia-lab-api:interface3 --format '{{.Size}}') / 1048576 )) MB"
# teste de fumaça da imagem: sobe isolada sem banco so pra ver se o codigo carrega
sudo docker run --rm -e DATABASE_URL=postgresql://x:x@127.0.0.1:1/x -e NODE_ENV=production operaia-lab-api:interface3 sh -c 'cd apps/api && timeout 25 npx tsx -e "import(\"./src/app.ts\").then(()=>console.log(\"APP_MODULE_OK\")).catch(e=>{console.log(\"APP_MODULE_FAIL\", e.message);process.exit(1)})"' 2>&1 | tail -3
