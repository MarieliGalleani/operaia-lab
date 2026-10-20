# Somente leitura: quanto de memoria existe agora
Q() { sudo docker exec operaia-lab-postgres psql -U operaia -d operaia_lab -tAc "$1" < /dev/null; }
for t in operational_memory_notes mission_learnings niche_memory_notes knowledge_items; do echo "$t=$(Q "select count(*) from $t")"; done
Q "select kind, count(*), sum(case when cardinality(embedding)>0 then 1 else 0 end) from operational_memory_notes group by 1"
