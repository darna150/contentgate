export const WORKSPACE_ROLES = ["admin", "approver", "member"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type WorkspaceSection =
  | "assets"
  | "knowledge"
  | "templates"
  | "content"
  | "approvals";

export type WorkspacePermissions = {
  canEditProduct: boolean;
  canManageAssets: boolean;
  canManageKnowledge: boolean;
  canManageTemplates: boolean;
  canGenerateContent: boolean;
  canOpenStudio: boolean;
  canReviewContent: boolean;
};

export type WorkspaceCounts = {
  assets: number;
  approvedSources: number;
  approvedClaims: number;
  activeTemplates: number;
  content: number;
  inReview: number;
};

export type WorkspaceEmptyStateCode =
  | "upload_first_asset"
  | "add_approved_knowledge"
  | "add_approved_source"
  | "add_approved_claim"
  | "configure_template"
  | "generate_first_content"
  | "queue_clear";

export type WorkspaceSectionState = {
  count: number;
  isEmpty: boolean;
  emptyState: WorkspaceEmptyStateCode | null;
  actionHref: string | null;
  canAct: boolean;
};

export type WorkspaceSectionStates = Record<
  WorkspaceSection,
  WorkspaceSectionState
>;

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return WORKSPACE_ROLES.includes(value as WorkspaceRole);
}

export function getWorkspacePermissions(input: {
  role: WorkspaceRole;
  productStatus: string;
  activeTemplateCount: number;
}): WorkspacePermissions {
  const isAdmin = input.role === "admin";
  const isReviewer = isAdmin || input.role === "approver";
  const productIsActive = input.productStatus === "active";
  const hasTemplate = input.activeTemplateCount > 0;

  return {
    canEditProduct: isAdmin,
    canManageAssets: isAdmin,
    canManageKnowledge: isAdmin,
    canManageTemplates: isAdmin,
    canGenerateContent: productIsActive && hasTemplate,
    canOpenStudio: productIsActive && hasTemplate,
    canReviewContent: isReviewer,
  };
}

export function getWorkspaceSectionStates(input: {
  productId: string;
  counts: WorkspaceCounts;
  permissions: WorkspacePermissions;
}): WorkspaceSectionStates {
  const { productId, counts, permissions } = input;
  const knowledgeCount = counts.approvedSources + counts.approvedClaims;
  const knowledgeEmptyState =
    knowledgeCount === 0
      ? "add_approved_knowledge"
      : counts.approvedSources === 0
        ? "add_approved_source"
        : counts.approvedClaims === 0
          ? "add_approved_claim"
          : null;

  return {
    assets: {
      count: counts.assets,
      isEmpty: counts.assets === 0,
      emptyState: counts.assets === 0 ? "upload_first_asset" : null,
      actionHref: permissions.canManageAssets
        ? `/assets?product=${productId}`
        : null,
      canAct: permissions.canManageAssets,
    },
    knowledge: {
      count: knowledgeCount,
      isEmpty: knowledgeCount === 0,
      emptyState: knowledgeEmptyState,
      actionHref: permissions.canManageKnowledge
        ? `/knowledge/new?product=${productId}`
        : null,
      canAct: permissions.canManageKnowledge,
    },
    templates: {
      count: counts.activeTemplates,
      isEmpty: counts.activeTemplates === 0,
      emptyState:
        counts.activeTemplates === 0 ? "configure_template" : null,
      actionHref: permissions.canManageTemplates
        ? `/products/${productId}/edit`
        : null,
      canAct: permissions.canManageTemplates,
    },
    content: {
      count: counts.content,
      isEmpty: counts.content === 0,
      emptyState: counts.content === 0 ? "generate_first_content" : null,
      actionHref: permissions.canGenerateContent
        ? `/products/${productId}`
        : null,
      canAct: permissions.canGenerateContent,
    },
    approvals: {
      count: counts.inReview,
      isEmpty: counts.inReview === 0,
      emptyState: counts.inReview === 0 ? "queue_clear" : null,
      actionHref: permissions.canReviewContent
        ? `/approvals?product=${productId}`
        : null,
      canAct: permissions.canReviewContent,
    },
  };
}
