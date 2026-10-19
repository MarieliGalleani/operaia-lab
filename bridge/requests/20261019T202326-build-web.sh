# AUTORIZADO (17:23): publicar Interface 3.0. Passo 1/2: build isolado (nao toca no site no ar).
set -eu
cd /opt/operaia-lab
echo "== ferramentas: node $(node -v 2>/dev/null || echo ausente) pnpm $(pnpm -v 2>/dev/null || echo ausente)"
echo "== dono do repo: $(stat -c %U:%G /opt/operaia-lab) dist: $(stat -c %U:%G apps/web/dist)"
git fetch -q origin claude/interface-3
W=/opt/operaia-lab-releases/interface-3
sudo rm -rf "$W"; git worktree prune
git worktree add -f --detach "$W" FETCH_HEAD >/dev/null 2>&1 && echo "worktree em $(git -C $W log --oneline -1)"
cd "$W"
API=$(sudo grep '^VITE_API_URL=' /opt/operaia-lab/.env | cut -d= -f2- | tr -d '"' || true); API=${API:-https://api.operaia.com.br/api/v1}
echo "VITE_API_URL=$API"
pnpm install --frozen-lockfile --filter @operaia/web... > /tmp/w-install.log 2>&1 || { tail -20 /tmp/w-install.log; exit 1; }
VITE_API_URL="$API" pnpm --filter @operaia/web exec vite build > /tmp/w-build.log 2>&1 || { tail -30 /tmp/w-build.log; exit 1; }
tail -4 /tmp/w-build.log; ls -la apps/web/dist | head; du -sh apps/web/dist
