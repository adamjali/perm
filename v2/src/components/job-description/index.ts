/**
 * Job Description Components
 *
 * Components for managing job descriptions and templates in PERM cases.
 *
 * @example
 * ```tsx
 * // In case form
 * import { JobDescriptionField } from '@/components/job-description';
 *
 * // In case detail page
 * import { JobDescriptionDetailView } from '@/components/job-description';
 * ```
 */

export { JobDescriptionField } from "./JobDescriptionField";
export type {
  JobDescriptionFieldProps,
  JobDescriptionTemplate,
} from "./JobDescriptionField";

export { JobDescriptionDetailView } from "./JobDescriptionDetailView";
export type { JobDescriptionDetailViewProps } from "./JobDescriptionDetailView";

export { TemplateSelector } from "./TemplateSelector";
export type { TemplateSelectorProps } from "./TemplateSelector";

export { TemplateManagementModal } from "./TemplateManagementModal";
export type { TemplateManagementModalProps } from "./TemplateManagementModal";

export { TemplateUpdateConfirmDialog } from "./TemplateUpdateConfirmDialog";
export type { TemplateUpdateConfirmDialogProps } from "./TemplateUpdateConfirmDialog";

// Shared utilities and components
export {
  JOB_DESCRIPTION_MAX_LENGTH,
  copyToClipboard,
  formatTemplateDate,
  findTemplateByName,
  isTemplateNameTaken,
  TemplateStatusBadge,
  TemplateTypeBadge,
} from "./shared";
export type { JobDescriptionTemplateData } from "./shared";
