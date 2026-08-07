import { supabase } from "../../lib/supabase";
import { offlineDb } from "../../lib/offlineDb";
import type { SectionVM } from "../assets/types";

export async function loadInspectionSections(inspectionId: string): Promise<SectionVM[]> {
  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .select("id, template_version_id")
    .eq("id", inspectionId)
    .single();

  if (!inspectionError && inspection) {
    const { data, error } = await supabase
      .from("inspection_sections")
      .select(`
        id, code, title, instructions, sort_order,
        inspection_questions(
          id, code, prompt, help_text, question_type, unit, options,
          is_required, evidence_required, min_photos, sort_order
        )
      `)
      .eq("template_version_id", inspection.template_version_id)
      .order("sort_order");

    if (!error && data) {
      const sections = data.map((s: any) => ({
        ...s,
        questions: [...(s.inspection_questions ?? [])].sort(
          (a: any, b: any) => a.sort_order - b.sort_order
        )
      })) as SectionVM[];

      const db = await offlineDb;
      await db.put("templates", { id: inspection.template_version_id, sections });
      return sections;
    }
  }

  const db = await offlineDb;
  const templates = await db.getAll("templates");
  const cached = templates.find((t: any) => t.inspectionId === inspectionId);
  if (cached) return cached.sections;

  throw new Error("Inspection template unavailable online and not cached offline.");
}
