# Teste minimo (poucos tokens): o modelo padrao do codigo existe?
for m in claude-sonnet-5 claude-sonnet-5-5; do
sudo docker exec -e M=$m operaia-lab-api sh -c 'node -e "
fetch(\"https://api.anthropic.com/v1/messages\",{method:\"POST\",headers:{\"x-api-key\":process.env.ANTHROPIC_API_KEY,\"anthropic-version\":\"2023-06-01\",\"content-type\":\"application/json\"},body:JSON.stringify({model:process.env.M,max_tokens:5,messages:[{role:\"user\",content:\"ok\"}]})}).then(async r=>{const t=await r.text(); console.log(process.env.M,\"->\",r.status, t.slice(0,160))}).catch(e=>console.log(\"erro\",e.message))"' < /dev/null
done
