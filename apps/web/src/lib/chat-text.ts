/**
 * Texto do chat da Opera -> HTML seguro.
 * So entende **negrito** e listas com "- ". Todo o resto e escapado: a
 * resposta vem de IA e nunca pode injetar HTML na pagina.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function renderChatText(text: string): string {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const item = /^[-*•]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (item) {
      list.push(inline(item[1]!));
      continue;
    }
    flush();
    if (!line) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    out.push(heading ? `<p><strong>${inline(heading[1]!)}</strong></p>` : `<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("");
}
