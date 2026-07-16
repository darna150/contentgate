import { notFound } from "next/navigation";

import { loadStudioState } from "../studio-data";
import { StudioPageView } from "../studio-page-view";

export default async function StudioContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const [{ contentId }, query] = await Promise.all([params, searchParams]);
  const state = await loadStudioState({
    contentId,
    size: query.size,
  });

  if (!state.selectedProduct || !state.selectedTemplate) {
    notFound();
  }

  return <StudioPageView state={state} />;
}
