import { Prisma } from "@operaia/database";
import { isDomainError } from "@operaia/shared";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { OfficeUnavailableError } from "../modules/automation-office/automation-office.errors.js";

/**
 * Handler central de erros: traduz erros de dominio, validacao e Prisma
 * para respostas HTTP consistentes, sem vazar detalhes de infraestrutura.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (hasZodFastifySchemaValidationErrors(error)) {
    reply.status(400).send({
      code: "VALIDATION_ERROR",
      message: "Dados da requisicao invalidos.",
      issues: error.validation,
    });
    return;
  }

  if (isDomainError(error)) {
    if (error instanceof OfficeUnavailableError) {
      reply.status(error.httpStatus).send({
        code: error.code,
        message: error.message,
        degradations: error.degradations,
      });
      return;
    }
    reply.status(error.httpStatus).send({
      code: error.code,
      message: error.message,
    });
    return;
  }

  if (error.statusCode === 429) {
    reply.status(429).send({
      code: "RATE_LIMITED",
      message: "Muitas requisicoes. Tente novamente mais tarde.",
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      reply
        .status(404)
        .send({ code: "NOT_FOUND", message: "Recurso nao encontrado." });
      return;
    }
    if (error.code === "P2003") {
      reply.status(422).send({
        code: "INVALID_REFERENCE",
        message: "Referencia invalida (projeto ou agente inexistente).",
      });
      return;
    }
    if (error.code === "P2002") {
      reply
        .status(409)
        .send({ code: "CONFLICT", message: "Registro duplicado." });
      return;
    }
  }

  request.log.error(error);
  reply
    .status(500)
    .send({ code: "INTERNAL_ERROR", message: "Erro interno do servidor." });
}
