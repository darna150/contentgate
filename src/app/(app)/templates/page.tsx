import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  prompt_body: string;
  output_type: string;
};

const TYPE_LABELS: Record<string, string> = {
  social: "Social",
  email: "Email",
  flyer: "Print",
};

export default async function TemplatesPage() {
  let templates: TemplateRow[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("templates")
      .select("id, name, description, prompt_body, output_type")
      .order("created_at", { ascending: true });
    templates = data ?? [];
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Template Library</h1>
        <p className="text-[14.5px] text-ink-muted">
          Your organization&apos;s content formats. Pick one to prefill the
          generator.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-6"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold">{t.name}</h2>
              <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
                {TYPE_LABELS[t.output_type] ?? t.output_type}
              </span>
            </div>
            {t.description && (
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {t.description}
              </p>
            )}
            <p className="line-clamp-4 rounded-control border border-edge bg-page px-3.5 py-3 text-[12px] leading-relaxed text-ink-faint">
              {t.prompt_body}
            </p>
            <Link
              href={`/generate?template=${t.id}`}
              className="mt-auto rounded-control bg-brand px-4 py-2.5 text-center text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Use in generator
            </Link>
          </div>
        ))}
      </div>

      <p className="text-[12.5px] text-ink-faint">
        Templates are managed per organization — custom formats are added during
        onboarding.
      </p>
    </div>
  );
}
