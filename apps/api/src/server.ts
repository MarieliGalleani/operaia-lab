import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function start(): Promise<void> {
  const { app, continuous } = buildApp();

  try {
    await continuous.start();
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    app.log.info(
      {
        continuous: continuous.enabled,
        workers: continuous.workers.list().length,
        supervisor: continuous.supervisor.isRunning,
        intervalMs: env.SCHEDULER_INTERVAL_MS,
      },
      "API + Operational Supervisor v2 no ar",
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info(
      { signal, component: "graceful-shutdown" },
      "Recebido sinal — encerrando Supervisor, workers e API...",
    );
    try {
      await continuous.stop();
      await app.close();
      app.log.info(
        { component: "graceful-shutdown" },
        "Shutdown completo",
      );
      process.exit(0);
    } catch (error) {
      app.log.error(error);
      process.exit(1);
    }
  };

  // Um erro solto (promessa sem tratamento) derrubava a API inteira — visto
  // em 20/10 no andar Negocio. Registra e segue; o pedido que falhou ja
  // respondeu 500 para quem chamou.
  process.on("unhandledRejection", (reason) => {
    app.log.error({ err: reason }, "promessa rejeitada sem tratamento (API segue no ar)");
  });
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void start();
