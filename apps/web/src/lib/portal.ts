import { supabase } from "./supabase";
export function vaultObjectPath(value: string, companyId: string) {
  const path = value.startsWith("generated-documents/") ? value.slice("generated-documents/".length) : value;
  if (!path.startsWith(companyId + "/") || /(^|\/)\.\.?($|\/)|[\\\x00-\x1f]|:\/\//.test(path)) {
    throw new Error("This document is not ready for download. Please contact ASUKA247.");
  }
  return path;
}
export async function downloadVaultDocument(path: string, filename: string, companyId: string) {
  if (!supabase) throw new Error("The document service is unavailable.");
  const { data, error } = await supabase.storage.from("generated-documents").download(vaultObjectPath(path, companyId));
  if (error) throw new Error("Unable to download this document. Please check your access or contact ASUKA247.");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url; a.download = filename.replace(/[\\/\x00-\x1f]/g, "_") || "ASUKA247-document";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
