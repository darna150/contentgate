import { redirect } from "next/navigation";

import { studioContentUrl, studioNewUrl } from "@/lib/creative";
import { normalizePlatformAssignmentId } from "./studio-data";

export default async function StudioCompatPage({
  searchParams,
}: {
  searchParams: Promise<{
    assignment?: string;
    product?: string;
    template?: string;
    content?: string;
    size?: string;
  }>;
}) {
  const query = await searchParams;
  if (query.content) {
    redirect(studioContentUrl(query.content, query.size));
  }

  const assignmentId = query.assignment
    ? normalizePlatformAssignmentId(query.assignment)
    : query.template?.startsWith("platform:")
      ? normalizePlatformAssignmentId(query.template)
      : null;

  redirect(
    studioNewUrl({
      productId: query.product,
      assignmentId,
      size: query.size,
    })
  );
}
