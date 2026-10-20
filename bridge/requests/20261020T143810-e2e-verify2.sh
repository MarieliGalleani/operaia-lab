docker exec -w /app/apps/api operaia-lab-api npx tsx ./.e2e-clean.mts 2>&1 | grep -v "^\[llm\]" | tail -3
