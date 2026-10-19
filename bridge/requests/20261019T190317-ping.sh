echo "== whoami: $(whoami)@$(hostname)  $(date -u)"
echo "== uptime"; uptime
echo "== disco"; df -h / | tail -1
echo "== memoria"; free -h | head -2
echo "== git /opt/operaia-lab"; cd /opt/operaia-lab && git branch --show-current && git log --oneline -3 && git status -s | head -10
echo "== servicos"; systemctl list-units --type=service --no-pager --plain | grep -iE "operaia|caddy|n8n|postgres|docker" 
echo "== timers"; systemctl list-timers --no-pager | grep -i operaia
echo "== containers"; sudo docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
