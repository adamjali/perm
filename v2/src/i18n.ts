/**
 * Internationalization Configuration
 *
 * Configures next-intl for the PERM Tracker application.
 * Currently supports English only, with infrastructure for future locales.
 *
 * @see https://next-intl.dev/docs/getting-started/app-router
 */

import { getRequestConfig } from "next-intl/server";

/**
 * Supported locales.
 * Add new locales here when translations are ready.
 */
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

/**
 * Default locale for the application.
 */
export const defaultLocale: Locale = "en";

/**
 * Server-side request configuration.
 * Loads messages for the current locale.
 */
export default getRequestConfig(async () => {
  // Currently hardcoded to English
  // Future: detect from headers, cookies, or URL
  const locale: Locale = "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
