docker inspect operaia-lab-api --format 'restarts={{.RestartCount}} started={{.State.StartedAt}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}'
docker exec operaia-lab-api sh -c 'grep -c "businessImport\|storeFlowRun" $(find /app/node_modules -path "*.prisma/client/index.d.ts" | head -1); find /app/node_modules -path "*.prisma/client/index.d.ts" | head -3'
