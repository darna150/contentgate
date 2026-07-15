import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldLabel } from "@/lib/templates";
import { fieldLimitText, type FieldIssue, type FieldLimits } from "@/lib/template-fields";
import { cn } from "@/lib/utils";

export function StudioFields({
  fields,
  values,
  limits,
  editable,
  issuesByField,
  overflowFields,
  onChange,
}: {
  fields: string[];
  values: Record<string, string>;
  limits: FieldLimits;
  editable: boolean;
  issuesByField: Record<string, FieldIssue[]>;
  overflowFields: string[];
  onChange?: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
      <span className="text-label text-ink-faint">Text fields</span>
      {fields.map((key) => {
        const issues = issuesByField[key] ?? [];
        const overflowing = overflowFields.includes(key);
        const hasProblem = issues.length > 0 || overflowing;
        return (
          <div
            key={key}
            className="flex flex-col gap-1.5 border-b border-edge pb-3 last:border-0 last:pb-0"
          >
            <Label className="text-[11px] normal-case tracking-normal text-ink-faint">
              {fieldLabel(key)} · {fieldLimitText(limits[key])}
            </Label>
            {editable ? (
              <Textarea
                value={values[key] ?? ""}
                onChange={(event) => onChange?.(key, event.target.value)}
                rows={Math.min(5, Math.max(1, limits[key]?.max_lines ?? 2))}
                className={cn(
                  "resize-none text-[12.5px]",
                  hasProblem && "border-reject focus:border-reject"
                )}
              />
            ) : (
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink">
                {values[key] || "—"}
              </p>
            )}
            {editable && (
              <span
                className={cn(
                  "text-[10.5px] font-semibold",
                  hasProblem ? "text-reject" : "text-approve"
                )}
              >
                {issues.length
                  ? issues.map((issue) => issue.message).join(" · ")
                  : overflowing
                    ? "Text does not fit this locked design"
                    : "✓ Fits template"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
