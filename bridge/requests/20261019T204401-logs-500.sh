# Somente leitura: erros 500 recentes da API (autorizado: logs e saude)
sudo docker logs --since 3h operaia-lab-api 2>&1 | grep -E '"statusCode":5[0-9][0-9]|"level":50|"level":"error"' | sed -E 's/"(authorization|cookie|token|password|secret|key)":"[^"]*"/"\1":"***"/Ig' | cut -c1-400 | tail -12
echo "== rota external-automations"; sudo docker logs --since 3h operaia-lab-api 2>&1 | grep -B2 -A8 'external-automations' | grep -iE 'err|message|stack' | cut -c1-400 | head -10
