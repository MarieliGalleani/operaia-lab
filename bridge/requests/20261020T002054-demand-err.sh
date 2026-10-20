# Somente leitura: erro da demanda de teste
sudo docker logs --since 5m operaia-lab-api 2>&1 | grep -E '"statusCode":(4|5)[0-9][0-9]|"level":(40|50)|error' | grep -v GITHUB | sed -E 's/(gh[pousr]_|sk-|AIza)[A-Za-z0-9_-]+/***/g' | cut -c1-600 | tail -10
echo ==; sudo docker logs --since 5m operaia-lab-api 2>&1 | grep -E '"method":"(POST|PUT|PATCH)"' | cut -c1-260 | tail -6
