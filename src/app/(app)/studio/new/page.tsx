import { redirect } from "next/navigation";

export default async function NewStudioRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string; product?: string; size?: string }>;
}) {
  const query = await searchParams;
  const next = new URLSearchParams();
  if (query.product) next.set("product", query.product);
  if (query.assignment) next.set("assignment", query.assignment);
  if (query.size) next.set("size", query.size);
  redirect(`/studio${next.toString() ? `?${next.toString()}` : ""}`);
}
