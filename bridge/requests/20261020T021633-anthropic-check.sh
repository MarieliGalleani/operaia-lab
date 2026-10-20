# Somente leitura: a chave da Anthropic funciona?
sudo docker exec operaia-lab-api sh -c 'node -e "
fetch(\"https://api.anthropic.com/v1/models?limit=1\",{headers:{\"x-api-key\":process.env.ANTHROPIC_API_KEY,\"anthropic-version\":\"2023-06-01\"}}).then(async r=>{const t=await r.text(); console.log(\"anthropic ->\",r.status, t.slice(0,220).replace(/sk-ant-[\\w-]+/g,\"***\"))}).catch(e=>console.log(\"erro\",e.message))"'
sudo docker logs --since 15m operaia-lab-api 2>&1 | grep -iE 'anthropic|fallback|llm_call|"provider"' | sed -E 's/sk-ant-[A-Za-z0-9_-]+/***/g' | cut -c1-260 | tail -8
