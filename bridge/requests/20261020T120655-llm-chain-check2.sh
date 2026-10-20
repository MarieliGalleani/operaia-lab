docker exec -w /app/apps/api operaia-lab-api node --input-type=module -e 'try { await import("@operaia/ai-core"); console.log("import ok") } catch(e) { console.log("ERR", e.code, String(e.message).slice(0,200)) }'
docker exec operaia-lab-api sh -c 'ls /app/packages 2>/dev/null | head; ls /app/apps/api; cat /app/apps/api/package.json | grep -E "\"(start|main)\""'
