export const UIUX_MEASUREMENT_EVENTS = [
  "studio_opened",
  "studio_preview_ready",
  "studio_picker_selected",
  "studio_picker_saved",
  "studio_save_completed",
  "studio_generation_started",
  "studio_generation_completed",
  "studio_generation_failed",
  "studio_format_selected",
  "studio_review_submitted",
  "review_decision",
  "export_started",
  "export_completed",
  "preview_error",
] as const;

export type UiUxMeasurementEvent = (typeof UIUX_MEASUREMENT_EVENTS)[number];
export type MeasurementValue = string | number | boolean | null | undefined;
export type MeasurementProperties = Record<string, MeasurementValue>;

const ALLOWED_PROPERTY_KEYS: Record<UiUxMeasurementEvent, readonly string[]> = {
  studio_opened: ["entry_surface", "route_kind"],
  studio_preview_ready: ["format_key", "duration_ms", "mode", "asset_count"],
  studio_picker_selected: ["picker_type", "option_key", "format_key"],
  studio_picker_saved: ["picker_type", "duration_ms", "outcome"],
  studio_save_completed: ["duration_ms", "outcome", "conflict_reason"],
  studio_generation_started: ["format_key", "source_count", "has_revision", "copied_from_campaign"],
  studio_generation_completed: ["duration_ms", "outcome", "fit_state", "evidence_count"],
  studio_generation_failed: ["duration_ms", "safe_reason_code"],
  studio_format_selected: ["from_format", "to_format", "source_of_change"],
  studio_review_submitted: ["format_key"],
  review_decision: ["decision", "change_reason"],
  export_started: ["type", "format_key", "file_format", "quality"],
  export_completed: ["type", "duration_ms", "outcome"],
  preview_error: ["safe_reason_code", "format_key"],
};

// This allowlist is deliberately stricter than the database backstop: pilot
// telemetry is operational metadata, never user-authored content or IDs.
export function safeUiUxMeasurementProperties(
  eventName: UiUxMeasurementEvent,
  properties: MeasurementProperties,
) {
  const allowed = new Set(ALLOWED_PROPERTY_KEYS[eventName]);
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        allowed.has(key) &&
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null),
    ),
  );
}
