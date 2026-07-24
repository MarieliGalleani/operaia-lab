/** Helpers SVG para area/line charts do Painel VPS (estilo analytics motion). */

export interface SeriesPoint {
  readonly t: number;
  readonly value: number;
}

export function toSparkLine(values: number[], w = 120, h = 36): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Path de linha + área preenchida (para gráficos grandes estilo Olayard). */
export function toAreaPaths(
  values: number[],
  w = 560,
  h = 180,
): { line: string; area: string } {
  if (values.length < 2) return { line: "", area: "" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padY = 12;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - padY - ((v - min) / span) * (h - padY * 2);
    return { x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const area = `${line} L${last.x.toFixed(1)} ${h} L${first.x.toFixed(1)} ${h} Z`;
  return { line, area };
}

export function donutOffset(pct: number, radius = 54): number {
  const c = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  return c - (clamped / 100) * c;
}
