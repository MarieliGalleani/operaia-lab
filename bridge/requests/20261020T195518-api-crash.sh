docker ps --filter name=operaia-lab-api --format '{{.Names}} {{.Status}}'
curl -s -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3333/api/v1/health
docker logs --since 5m operaia-lab-api 2>&1 | grep -iE 'error|business|prisma|exit|uncaught|fatal' | sed -E 's#//[^@]*@#//***@#g' | grep -oE '"(msg|message|code)":"[^"]{0,300}"|Error[^"]{0,300}|Invalid[^"]{0,300}' | sort | uniq -c | sort -rn | head -15
