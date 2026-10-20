docker ps --format '{{.Names}} {{.Image}}' | grep -i -E 'postgres|pg|db' 
docker exec operaia-lab-api sh -c 'echo "$DATABASE_URL" | sed -E "s#//[^@]*@#//***@#"'
df -h /opt | tail -1
