export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatAnswer(answer: unknown, unit?: string | null): string {
  if (answer === null || answer === undefined) return "Not recorded";
  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return JSON.stringify(answer);
  return `${String(answer)}${unit ? ` ${unit}` : ""}`;
}

export function outcomeClass(outcome?: string | null) {
  switch ((outcome ?? "").toLowerCase()) {
    case "pass": return "pass";
    case "fail": return "fail";
    case "conditional": return "conditional";
    default: return "neutral";
  }
}
