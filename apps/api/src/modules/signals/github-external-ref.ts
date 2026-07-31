/**
 * Extrai owner/repo canonico do payload GitHub (pre-HMAC / binding lookup).
 */
export function extractGithubExternalRef(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const repo = (body as Record<string, unknown>).repository;
  if (!repo || typeof repo !== "object" || Array.isArray(repo)) {
    return null;
  }
  const record = repo as Record<string, unknown>;
  const fullName =
    typeof record.full_name === "string" ? record.full_name.trim() : "";
  if (fullName.includes("/")) {
    return fullName.toLowerCase();
  }
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const ownerObj = record.owner;
  const ownerLogin =
    typeof ownerObj === "string"
      ? ownerObj.trim()
      : ownerObj &&
          typeof ownerObj === "object" &&
          !Array.isArray(ownerObj) &&
          typeof (ownerObj as Record<string, unknown>).login === "string"
        ? String((ownerObj as Record<string, unknown>).login).trim()
        : "";
  if (!ownerLogin || !name) {
    return null;
  }
  return `${ownerLogin}/${name}`.toLowerCase();
}
