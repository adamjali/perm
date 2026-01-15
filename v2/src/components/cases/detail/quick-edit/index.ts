/**
 * Quick Edit Module
 *
 * Provides inline editing capability for NextActionCard.
 */

export { QuickEditFields } from "./QuickEditFields";
export {
  ACTION_CONFIG,
  getActionConfig,
  isEditableAction,
  isWaitingAction,
  isComplexAction,
  getActionFieldNames,
  type ActionConfig,
  type QuickEditFieldConfig,
  type WaitingInfo,
} from "./action-config";
