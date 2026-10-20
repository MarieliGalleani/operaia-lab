docker exec -w /app/packages/ai-core operaia-lab-api sh -c 'ls /app/apps/api/node_modules/.bin/ | grep tsx; ls node_modules/@google 2>&1 | head -2'
docker exec -w /app/packages/ai-core operaia-lab-api npx --prefix /app/apps/api tsx ./.gl.mts 2>&1 | tail -6
