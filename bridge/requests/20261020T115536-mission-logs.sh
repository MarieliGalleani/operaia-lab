docker logs --since 15m operaia-lab-api 2>&1 | grep -E '73b6a16c|79d447b7|b0a142db' | grep -oE '"(msg|level|missionId|employeeId|status|err|message|reason)":"?[^,"]{0,140}' | head -60
