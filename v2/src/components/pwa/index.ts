/**
 * PWA Components
 *
 * Progressive Web App components for PERM Tracker:
 * - ServiceWorkerRegistration: Registers the main SW for caching
 * - InstallPromptProvider: Captures install prompt event
 * - useInstallPrompt: Hook for triggering install from settings
 */

export { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

export { InstallPromptProvider, useInstallPrompt } from "./InstallPrompt";
