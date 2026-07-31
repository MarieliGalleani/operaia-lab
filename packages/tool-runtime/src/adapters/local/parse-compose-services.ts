/**
 * Extrai nomes de services de um docker-compose (heuristica leve, sem YAML full).
 */
export function parseComposeServices(raw: string): readonly string[] {
  const lines = raw.split(/\r?\n/);
  let inServices = false;
  let servicesIndent = -1;
  const services: string[] = [];

  for (const line of lines) {
    if (/^\s*#/.test(line) || !line.trim()) {
      continue;
    }
    const match = /^(\s*)([^\s:#][^:]*):\s*(?:#.*)?$/.exec(line);
    if (!match) {
      if (inServices && servicesIndent >= 0) {
        const indent = leadingSpaces(line);
        if (indent <= servicesIndent && line.trim()) {
          // saiu do bloco services
          const key = line.trim().split(":")[0];
          if (key && indent === 0) {
            inServices = false;
          }
        }
      }
      continue;
    }

    const indent = match[1]?.length ?? 0;
    const key = (match[2] ?? "").trim();

    if (!inServices) {
      if (key === "services" && indent === 0) {
        inServices = true;
        servicesIndent = indent;
      }
      continue;
    }

    if (indent <= servicesIndent) {
      inServices = false;
      continue;
    }

    // service name: exatamente um nivel abaixo de "services:"
    if (indent === servicesIndent + 2 || indent === servicesIndent + 1) {
      if (key && !key.startsWith(".") && !services.includes(key)) {
        services.push(key);
      }
    }
  }

  return services;
}

function leadingSpaces(line: string): number {
  const m = /^(\s*)/.exec(line);
  return m?.[1]?.length ?? 0;
}
