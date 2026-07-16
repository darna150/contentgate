import { loadStudioState, normalizePlatformAssignmentId } from "../studio-data";
import { StudioPageView } from "../studio-page-view";

export default async function NewStudioPage({
  searchParams,
}: {
  searchParams: Promise<{
    assignment?: string;
    product?: string;
    template?: string;
    size?: string;
  }>;
}) {
  const query = await searchParams;
  const assignmentId = normalizePlatformAssignmentId(
    query.assignment ?? query.template
  );
  const state = await loadStudioState({
    productId: query.product,
    assignmentId,
    size: query.size,
  });

  return <StudioPageView state={state} />;
}
