/**
 * Auth Utilities
 *
 * Client-side authentication utilities for PERM Tracker.
 */

export {
  savePendingTermsAcceptance,
  getPendingTermsAcceptance,
  clearPendingTermsAcceptance,
  hasPendingTermsAcceptance,
  PENDING_TERMS_KEY,
} from "./termsStorage";
