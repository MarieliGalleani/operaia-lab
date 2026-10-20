docker logs --since 60m operaia-lab-api 2>&1 | grep -E 'aabe2f56' | grep -oE '"(reqId|method|url|statusCode|msg|message)":"?[^,"]{0,100}' | tail -24
