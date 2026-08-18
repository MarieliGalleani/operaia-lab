export const PUBLIC_STATUS_SERVICE = "operaia" as const;

export const PUBLIC_STATUS_OK = {
  status: "ok",
  service: PUBLIC_STATUS_SERVICE,
} as const;

export const PUBLIC_STATUS_UNAVAILABLE = {
  status: "unavailable",
} as const;

export type PublicStatusOk = typeof PUBLIC_STATUS_OK;
export type PublicStatusUnavailable = typeof PUBLIC_STATUS_UNAVAILABLE;

export type PublicStatusResult =
  | { readonly httpStatus: 200; readonly body: PublicStatusOk }
  | { readonly httpStatus: 503; readonly body: PublicStatusUnavailable };

/**
 * Disponibilidade HTTP minima. Nao consulta runtime, banco nem infraestrutura.
 */
export function resolvePublicStatus(
  probe: () => void = () => undefined,
): PublicStatusResult {
  try {
    probe();
    return { httpStatus: 200, body: PUBLIC_STATUS_OK };
  } catch {
    return { httpStatus: 503, body: PUBLIC_STATUS_UNAVAILABLE };
  }
}
