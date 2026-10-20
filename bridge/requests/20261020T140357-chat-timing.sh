docker logs --since 10m operaia-lab-api 2>&1 | grep -E 'ceo/chat|\[llm\]' | grep -oE '"(url|statusCode|responseTime)":"?[^,"]{0,80}|\[llm\][^"]{0,160}' | tail -12
