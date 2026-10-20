docker exec -w /app/packages/database operaia-lab-api sh -c 'ls prisma/migrations | tail -4; npx prisma migrate status --schema prisma/schema.prisma 2>&1 | sed -E "s#//[^@]*@#//***@#g" | tail -15'
