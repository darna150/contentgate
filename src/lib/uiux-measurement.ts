"use client";

import { createClient } from "@/lib/supabase/client";
import {
  safeUiUxMeasurementProperties,
  type MeasurementProperties,
  type UiUxMeasurementEvent,
} from "./uiux-measurement-contract";

export { safeUiUxMeasurementProperties, type UiUxMeasurementEvent } from "./uiux-measurement-contract";

export function recordUiUxMeasurementEvent(
  enabled: boolean,
  eventName: UiUxMeasurementEvent,
  properties: MeasurementProperties = {},
) {
  if (!enabled || typeof window === "undefined") return;

  const safeProperties = safeUiUxMeasurementProperties(eventName, properties);
  void createClient()
    .rpc("record_uiux_measurement_event", {
      p_event_name: eventName,
      p_properties: safeProperties,
    })
    // Analytics must never interrupt authoring, review, or export work.
    .then(() => undefined, () => undefined);
}
