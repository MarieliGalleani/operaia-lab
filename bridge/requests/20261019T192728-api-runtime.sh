# Somente leitura: como o container da API recebe env e como e recriado (sem imprimir valores)
D="sudo docker"
$D inspect operaia-lab-api --format 'labels={{json .Config.Labels}}
binds={{json .HostConfig.Binds}}
mounts={{json .Mounts}}
workdir={{.Config.WorkingDir}}
envcount={{len .Config.Env}}'
echo "== .env na VM tem GITHUB_TOKEN?"; sudo grep -c '^GITHUB_TOKEN=' /opt/operaia-lab/.env; sudo stat -c '%U:%G %a' /opt/operaia-lab/.env
echo "== o valor do .env == valor do container?"; A=$(sudo grep '^GITHUB_TOKEN=' /opt/operaia-lab/.env | cut -d= -f2- | tr -d '"' | sha256sum | cut -c1-12); B=$($D exec operaia-lab-api sh -c 'printf %s "$GITHUB_TOKEN"' | sha256sum | cut -c1-12); echo "env=$A container=$B"
echo "== operaia-host: referencias a operaia-lab-api"; sudo docker exec operaia-host-postgres psql -U postgres -l 2>/dev/null | head -5
ls /home/ubuntu /opt | head -40
sudo grep -rls "operaia-lab-api" /opt/operaia-host* /home/ubuntu/operaia-host* /home/ubuntu/*.sh 2>/dev/null | head
history 2>/dev/null | tail -1
sudo grep -h "operaia-lab-api" /home/ubuntu/.bash_history /root/.bash_history 2>/dev/null | grep -E "docker (run|build|compose)" | sed -E 's/(TOKEN|KEY|SECRET|PASSWORD)=[^ ]+/\1=***/g' | tail -5
