"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  recordUiUxMeasurementEvent,
  type UiUxMeasurementEvent,
} from "@/lib/uiux-measurement";

type MeasurementValue = string | number | boolean | null | undefined;
type MeasurementProperties = Record<string, MeasurementValue>;

const UiUxMeasurementContext = createContext<{
  enabled: boolean;
  track: (eventName: UiUxMeasurementEvent, properties?: MeasurementProperties) => void;
}>({
  enabled: false,
  track: () => undefined,
});

export function UiUxMeasurementProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const value = useMemo(
    () => ({
      enabled,
      track: (eventName: UiUxMeasurementEvent, properties: MeasurementProperties = {}) =>
        recordUiUxMeasurementEvent(enabled, eventName, properties),
    }),
    [enabled],
  );

  useEffect(() => {
    if (!enabled || !pathname.startsWith("/studio")) return;
    value.track("studio_opened", {
      entry_surface: "workspace",
      route_kind: pathname === "/studio/new" ? "new" : "draft",
    });
  }, [enabled, pathname, value]);

  return <UiUxMeasurementContext.Provider value={value}>{children}</UiUxMeasurementContext.Provider>;
}

export function useUiUxMeasurement() {
  return useContext(UiUxMeasurementContext);
}
