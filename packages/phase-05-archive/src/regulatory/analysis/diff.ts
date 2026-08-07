export interface DiffResult {
  addedLines: string[];
  removedLines: string[];
  changedLineCount: number;
  similarity: number;
}

export function simpleLineDiff(before: string, after: string): DiffResult {
  const a = normalise(before).split("\n").filter(Boolean);
  const b = normalise(after).split("\n").filter(Boolean);

  const aSet = new Set(a);
  const bSet = new Set(b);

  const removedLines = a.filter((line) => !bSet.has(line));
  const addedLines = b.filter((line) => !aSet.has(line));

  const union = new Set([...a, ...b]).size || 1;
  const intersection = [...aSet].filter((line) => bSet.has(line)).length;
  const similarity = intersection / union;

  return {
    addedLines: addedLines.slice(0, 250),
    removedLines: removedLines.slice(0, 250),
    changedLineCount: addedLines.length + removedLines.length,
    similarity
  };
}

function normalise(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
