# Somente leitura: erros 500 recentes da API (sem segredos)
sudo docker logs --since 6h operaia-lab-api 2>&1 | grep -E '"statusCode":5[0-9][0-9]|"level":50|"level":"error"' | sed -E 's/(gh[pousr]_|sk-|AIza)[A-Za-z0-9_-]+/***/g' | cut -c1-400 | tail -12
echo "== external-automations"; sudo docker logs --since 6h operaia-lab-api 2>&1 | grep -B2 -A8 'external-automations' | grep -iE 'err|message|n8n' | sed -E 's/(api[_-]?key|token)[^,]*/\1=***/Ig' | cut -c1-300 | tail -10
