import { createClient } from "@/lib/supabase/server";
import { GenerateForm, type DocOption, type TemplateOption } from "./generate-form";

export default async function GeneratePage() {
  let docs: DocOption[] = [];
  let templates: TemplateOption[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const [docsRes, templatesRes] = await Promise.all([
      supabase
        .from("documents")
        .select("id, title, product")
        .order("created_at", { ascending: false }),
      supabase
        .from("templates")
        .select("id, name, description, output_type")
        .order("created_at", { ascending: true }),
    ]);
    docs = docsRes.data ?? [];
    templates = templatesRes.data ?? [];
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Content Generator</h1>
        <p className="text-[14.5px] text-ink-muted">
          Localized marketing copy, grounded in approved documents. Everything
          generated starts as a draft.
        </p>
      </div>
      <GenerateForm docs={docs} templates={templates} />
    </div>
  );
}
