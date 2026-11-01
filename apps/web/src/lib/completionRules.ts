export function validateCompletion(notes: string, files: (File | null)[]) {
  if (notes.trim().length < 10 || notes.trim().length > 4000) throw new Error("Enter completion notes (10–4000 characters).");
  if (files.length !== 2 || files.some(f => !f)) throw new Error("Add a wide photograph and a separate detail photograph.");
  for (const f of files) {
    if (!f || !["image/jpeg", "image/png", "image/webp"].includes(f.type) || !f.size || f.size > 10485760)
      throw new Error("Use JPEG, PNG or WebP photographs, each up to 10 MB.");
  }
  if (files[0] === files[1]) throw new Error("Choose separate wide and detail photographs.");
}
