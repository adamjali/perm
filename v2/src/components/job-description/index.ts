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

export { TemplateSaveDialog } from "./TemplateSaveDialog";
export type { TemplateSaveDialogProps } from "./TemplateSaveDialog";

export { TemplateManagementModal } from "./TemplateManagementModal";
export type { TemplateManagementModalProps } from "./TemplateManagementModal";
