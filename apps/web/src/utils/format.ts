/** Saudacao dependente do horario ("Bom dia" / "Boa tarde" / "Boa noite"). */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Bom dia";
  }
  if (hour < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

/** Formata um ISO em hora local curta (HH:mm). */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata um ISO em data + hora curtas. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
