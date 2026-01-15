/**
 * Internationalization Utilities
 *
 * Re-exports next-intl hooks and utilities for consistent usage across the app.
 * This module serves as the single import point for i18n functionality.
 *
 * @example
 * ```tsx
 * import { useTranslations, useFormatter } from "@/lib/i18n";
 *
 * function MyComponent() {
 *   const t = useTranslations("common.buttons");
 *   const format = useFormatter();
 *
 *   return (
 *     <div>
 *       <button>{t("save")}</button>
 *       <span>{format.dateTime(new Date())}</span>
 *     </div>
 *   );
 * }
 * ```
 */

// Re-export hooks for client components
export { useTranslations, useFormatter, useLocale, useNow } from "next-intl";

// Re-export server utilities
export {
  getTranslations,
  getFormatter,
  getLocale,
  getNow,
  getMessages,
} from "next-intl/server";

// Re-export types
export type { TranslationValues, RichTranslationValues } from "next-intl";

// Export locale configuration
export { locales, defaultLocale, type Locale } from "@/i18n";

/**
 * Message namespaces for type-safe translations.
 * These correspond to top-level keys in the messages JSON.
 */
export type MessageNamespace =
  | "common"
  | "validation"
  | "cases"
  | "dashboard"
  | "forms"
  | "errors"
  | "calendar"
  | "timeline"
  | "settings"
  | "auth";
