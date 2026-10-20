docker logs --since 60m operaia-lab-api 2>&1 | grep -E '"reqId":"req-4[23]"' | grep -oE '"(time|statusCode|msg|message|code)":"?[^,"]{0,120}' | tail -16
docker logs --since 60m operaia-lab-api 2>&1 | grep -E '"reqId":"req-4[23]"' | grep -oE '"time":[0-9]+' | head -2
