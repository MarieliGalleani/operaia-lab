import { prisma } from "@operaia/database";
import { ArgonPasswordHasher } from "./argon-password-hasher.js";
import { normalizeLogin } from "./auth-service.js";

const MIN_ADMIN_PASSWORD_LENGTH = 14;

async function provisionAdmin(): Promise<void> {
  const login = normalizeLogin(process.env.OPERAIA_ADMIN_LOGIN ?? "");
  const password = process.env.OPERAIA_ADMIN_PASSWORD ?? "";
  if (!login || password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      "Defina OPERAIA_ADMIN_LOGIN e OPERAIA_ADMIN_PASSWORD com no minimo 14 caracteres.",
    );
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new Error(
      "Provisionamento recusado: ja existe uma identidade humana no banco.",
    );
  }

  const passwordHash = await new ArgonPasswordHasher().hash(password);
  const user = await prisma.user.create({
    data: {
      login,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
    select: { id: true, login: true },
  });
  console.log("Administrador provisionado com sucesso.", user);
}

provisionAdmin()
  .catch((error: unknown) => {
    console.log(
      "Falha ao provisionar administrador:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
