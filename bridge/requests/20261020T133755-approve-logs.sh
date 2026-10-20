docker logs --since 40m operaia-lab-api 2>&1 | grep -E '/approve|/reject' | grep -oE '"(method|url|statusCode|responseTime)":"?[^,"]{0,90}' | paste - - - - 2>/dev/null | tail -15
