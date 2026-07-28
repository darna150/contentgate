import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldLabel } from "@/lib/templates";
import type { FieldIssue, FieldLimits } from "@/lib/template-fields";
import { cn } from "@/lib/utils";

function compactFieldLabel(key: string) {
  if (key === "subheadline" || key === "subline" || key === "supportCopy") return "Subhead";
  if (key === "cta") return "CTA";
  return fieldLabel(key);
}

function fitIndicator(input: {
  value: string;
  limit?: FieldLimits[string];
  required: boolean;
  issues: FieldIssue[];
  overflowing: boolean;
}) {
  const max = input.limit?.max_chars;
  const count = input.value.length;
  if (max) {
    if (count > max) return `${count}/${max} · over by ${count - max}`;
    if (input.overflowing) return `${count}/${max} · layout over`;
    if (input.issues.length) return `${count}/${max} · needs edit`;
    return `${count}/${max} ✓ fits`;
  }
  if (!input.value.trim() && input.required) return "Required";
  if (input.overflowing) return "Layout over";
  if (input.issues.length) return input.issues.map((issue) => issue.message).join(" · ");
  return "✓ fits";
}

export function StudioFields({
  fields,
  requiredFields,
  values,
  limits,
  editable,
  issuesByField,
  overflowFields,
  onChange,
}: {
  fields: string[];
  requiredFields: string[];
  values: Record<string, string>;
  limits: FieldLimits;
  editable: boolean;
  issuesByField: Record<string, FieldIssue[]>;
  overflowFields: string[];
  onChange?: (key: string, value: string) => void;
}) {
  const required = new Set(requiredFields);
  return (
    <div className="flex flex-col gap-3">
      <span className="text-label text-ink-faint">Copy</span>
      {fields.map((key) => {
        const issues = issuesByField[key] ?? [];
        const overflowing = overflowFields.includes(key);
        const hasProblem = issues.length > 0 || overflowing;
        const value = values[key] ?? "";
        const indicator = fitIndicator({
          value,
          limit: limits[key],
          required: required.has(key),
          issues,
          overflowing,
        });
        const rows = Math.min(4, Math.max(1, limits[key]?.max_lines ?? (key === "cta" ? 1 : 2)));
        return (
          <div
            key={key}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor={`studio-field-${key}`}
                className="text-[13px] font-normal text-ink-muted"
              >
                {compactFieldLabel(key)}
                {!required.has(key) ? " · Optional" : ""}
              </Label>
              {editable && (
                <span
                  className={cn(
                    "shrink-0 text-[13px] font-semibold",
                    hasProblem ? "text-reject" : "text-brand"
                  )}
                >
                  {indicator}
                </span>
              )}
            </div>
            {editable ? (
              <Textarea
                id={`studio-field-${key}`}
                value={value}
                onChange={(event) => onChange?.(key, event.target.value)}
                rows={rows}
                className={cn(
                  "min-h-0 resize-none rounded-[8px] bg-surface px-4 py-3 text-[16px] leading-snug text-ink",
                  hasProblem && "border-reject focus:border-reject"
                )}
              />
            ) : (
              <p className="whitespace-pre-line rounded-[8px] border border-edge bg-page px-4 py-3 text-[14px] leading-relaxed text-ink">
                {value || "—"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
