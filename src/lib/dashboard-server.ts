import "server-only";

import {
  CONTENT_LIST_SELECT,
  flattenContentRow,
  type FlattenedContentRow,
  type ContentListRow,
} from "@/lib/content-listing";
import { createClient } from "@/lib/supabase/server";

export type DashboardSummary = {
  counts: {
    documents: number;
    content: number;
    inReview: number;
  };
  attention: FlattenedContentRow[];
  recentActivity: FlattenedContentRow[];
};

export async function getDashboardSummary({
  attentionLimit = 5,
  activityLimit = 5,
}: {
  attentionLimit?: number;
  activityLimit?: number;
} = {}): Promise<DashboardSummary> {
  const safeAttentionLimit = Math.min(Math.max(attentionLimit, 1), 20);
  const safeActivityLimit = Math.min(Math.max(activityLimit, 1), 20);
  const supabase = await createClient();
  const [
    docs,
    content,
    pending,
    attentionRows,
    recentRows,
  ] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase
      .from("generated_content")
      .select("id", { count: "exact", head: true })
      .not("product_id", "is", null),
    supabase
      .from("generated_content")
      .select("id", { count: "exact", head: true })
      .not("product_id", "is", null)
      .eq("status", "in_review"),
    supabase
      .from("generated_content")
      .select(CONTENT_LIST_SELECT)
      .not("product_id", "is", null)
      .eq("status", "in_review")
      .order("created_at", { ascending: true })
      .limit(safeAttentionLimit),
    supabase
      .from("generated_content")
      .select(CONTENT_LIST_SELECT)
      .not("product_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(safeActivityLimit),
  ]);

  for (const [label, result] of [
    ["documents", docs],
    ["content", content],
    ["pending content", pending],
    ["attention content", attentionRows],
    ["recent activity", recentRows],
  ] as const) {
    if (result.error) {
      throw new Error(`Could not load dashboard ${label}: ${result.error.message}`);
    }
  }

  return {
    counts: {
      documents: docs.count ?? 0,
      content: content.count ?? 0,
      inReview: pending.count ?? 0,
    },
    attention: ((attentionRows.data ?? []) as ContentListRow[]).map(flattenContentRow),
    recentActivity: ((recentRows.data ?? []) as ContentListRow[]).map(flattenContentRow),
  };
}
