import { redirect } from "next/navigation";

export default async function StudioContentRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const [{ contentId }, query] = await Promise.all([params, searchParams]);
  const next = new URLSearchParams({ content: contentId });
  if (query.size) next.set("size", query.size);
  redirect(`/studio?${next.toString()}`);
}
