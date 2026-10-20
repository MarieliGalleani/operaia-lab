for d in /opt /home/ubuntu /srv; do [ -d "$d" ] && find "$d" -maxdepth 4 -iname '*jarvis*' -not -path '*/node_modules/*' 2>/dev/null | head -10; done
grep -rli --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist -m1 jarvis /opt/operaia-lab /home/ubuntu 2>/dev/null | grep -v '\.env' | head -15
docker ps --format '{{.Names}}' | grep -i jarvis
