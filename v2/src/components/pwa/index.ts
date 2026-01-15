/**
 * PWA Components
 *
 * Progressive Web App components for PERM Tracker:
 * - ServiceWorkerRegistration: Registers the main SW for caching
 * - InstallPromptProvider: Captures install prompt event
 * - useInstallPrompt: Hook for triggering install from settings
 *
 * Phase: 31 (PWA)
 * Created: 2025-01-11
 */

export {
  ServiceWorkerRegistration,
  default as ServiceWorkerRegistrationDefault,
} from "./ServiceWorkerRegistration";

export {
  InstallPromptProvider,
  useInstallPrompt,
  default as InstallPromptDefault,
} from "./InstallPrompt";
