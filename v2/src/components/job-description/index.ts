/**
 * Job description parts: the one editor (used by the case form and the case page), the form's folding
 * section around it, the template list and manager, and the suggestion from a case's SOC code.
 */

export { JobDescriptionEditor } from "./JobDescriptionEditor";
export type { JobDescriptionEditorProps } from "./JobDescriptionEditor";

export { JobDescriptionField } from "./JobDescriptionField";
export type { JobDescriptionFieldProps, JobDescriptionTemplate } from "./JobDescriptionField";

export { SocDescriptionSuggestion } from "./SocDescriptionSuggestion";

export { TemplateSelector } from "./TemplateSelector";
export type { TemplateSelectorProps } from "./TemplateSelector";

export { TemplateManagementModal } from "./TemplateManagementModal";
export type { TemplateManagementModalProps } from "./TemplateManagementModal";

export {
  copyToClipboard,
  formatTemplateDate,
  isTemplateNameTaken,
  templateErrorMessage,
  TemplateStatusBadge,
  TemplateTypeBadge,
} from "./shared";
