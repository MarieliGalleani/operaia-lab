docker cp /tmp/gl.mts operaia-lab-api:/app/packages/ai-core/.gl.mts
docker exec -w /app/packages/ai-core operaia-lab-api /app/apps/api/node_modules/.bin/tsx ./.gl.mts 2>&1 | tail -8
