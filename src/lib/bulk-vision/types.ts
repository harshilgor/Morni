export type BulkVisionFailureKind =
  | "provider_timeout"
  | "provider_error"
  | "parser_failure"
  | "id_reconciliation_failure"
  | "validation_failure"
  | "incomplete_coverage"
  | "model_failure";

export type BulkVisionGenerationStatus = "ok" | "partial" | "failed" | "manual";

export type BulkVisionImageInput = {
  /** Client-stable photo id (UUID). */
  id: string;
  /** Original filename — metadata/debug only. Never used for listing fields. */
  name: string;
  data: string;
};

export type InternalImageRef = {
  internalId: string;
  clientId: string;
  originalFilename: string;
  index: number;
};

export type RawVisionGroup = {
  imageIds: string[];
  title?: string;
  description?: string;
  categorySlug?: string;
  colorName?: string;
  confidence?: number;
  needsReview?: boolean;
  colorGroups?: Array<{
    imageIds: string[];
    colorName?: string;
    confidence?: number;
    needsReview?: boolean;
  }>;
};

export type ValidatedBulkGroup = {
  imageIds: string[];
  title: string;
  description: string;
  categorySlug: string;
  colorName: string;
  confidence: number;
  needsReview: boolean;
  aiGenerated: boolean;
  generationStatus: BulkVisionGenerationStatus;
  failureReason?: string;
  rejectedFields?: Array<{ field: string; reason: string }>;
  colorGroups: Array<{
    imageIds: string[];
    colorName: string;
    confidence: number;
    needsReview: boolean;
  }>;
};

export type BulkAnalyzeResult = {
  groups: ValidatedBulkGroup[];
  status: BulkVisionGenerationStatus;
  warning?: string;
  failureKind?: BulkVisionFailureKind;
};
