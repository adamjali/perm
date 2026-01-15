/**
 * Accessibility Testing Utilities
 *
 * Provides axe-core integration for automated WCAG 2.1 AA compliance testing.
 * Use these utilities in component and page tests.
 *
 * @example
 * ```tsx
 * import { checkA11y, A11Y_RULES } from "@/lib/testing/a11y";
 *
 * describe("MyComponent", () => {
 *   it("should have no accessibility violations", async () => {
 *     const { container } = render(<MyComponent />);
 *     await checkA11y(container);
 *   });
 * });
 * ```
 */

import { axe, configureAxe, type AxeMatchers } from "vitest-axe";
import type { AxeResults, Result, RunOptions } from "axe-core";

// Extend vitest matchers with axe assertions
// Note: This must be done in vitest.setup.ts
export type { AxeMatchers };

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default axe configuration for WCAG 2.1 AA compliance.
 */
export const axeConfig: RunOptions = {
  // Target WCAG 2.1 AA conformance
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
  },
};

/**
 * Create configured axe instance.
 */
export const configuredAxe = configureAxe({
  ...axeConfig,
});

// Re-export axe for direct use
export { axe, configureAxe };

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Check element for accessibility violations.
 * Returns the axe results for use with toHaveNoViolations matcher.
 *
 * @param container - DOM element to test
 * @param options - Optional axe run options override
 * @returns Promise of AxeResults
 */
export async function checkA11y(
  container: Element | string,
  options?: RunOptions
): Promise<AxeResults> {
  return configuredAxe(container, options);
}

/**
 * Get accessibility violations from results.
 */
export function getViolations(results: AxeResults): Result[] {
  return results.violations;
}

/**
 * Format violations for readable error output.
 */
export function formatViolations(violations: Result[]): string {
  if (violations.length === 0) {
    return "No accessibility violations found.";
  }

  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${node.html}\n    ${node.failureSummary}`)
        .join("\n");
      return `[${violation.impact}] ${violation.id}: ${violation.description}\n${nodes}`;
    })
    .join("\n\n");
}

// ============================================================================
// RULE REFERENCES
// ============================================================================

/**
 * Common accessibility rules to test for.
 * Reference: https://dequeuniversity.com/rules/axe/4.9
 */
export const A11Y_RULES = {
  // Keyboard navigation
  KEYBOARD_ACCESSIBLE: "keyboard",
  FOCUS_VISIBLE: "focus-visible",
  TAB_ORDER: "tabindex",

  // Color and contrast
  COLOR_CONTRAST: "color-contrast",
  COLOR_CONTRAST_ENHANCED: "color-contrast-enhanced",

  // Form accessibility
  LABEL: "label",
  FORM_FIELD_MULTIPLE_LABELS: "form-field-multiple-labels",
  INPUT_IMAGE_ALT: "input-image-alt",

  // ARIA
  ARIA_HIDDEN: "aria-hidden-focus",
  ARIA_REQUIRED: "aria-required-attr",
  ARIA_VALID: "aria-valid-attr",
  ARIA_ROLES: "aria-roles",

  // Content
  HEADING_ORDER: "heading-order",
  BYPASS_BLOCKS: "bypass",
  LINK_NAME: "link-name",
  BUTTON_NAME: "button-name",
  IMAGE_ALT: "image-alt",

  // Landmarks
  REGION: "region",
  LANDMARK_UNIQUE: "landmark-unique",
} as const;

// ============================================================================
// WCAG SUCCESS CRITERIA MAPPING
// ============================================================================

/**
 * WCAG 2.1 AA Success Criteria mapped to common issues.
 * Use for documentation and tracking compliance.
 */
export const WCAG_CRITERIA = {
  // Level A
  "1.1.1": "Non-text Content",
  "1.3.1": "Info and Relationships",
  "1.3.2": "Meaningful Sequence",
  "1.4.1": "Use of Color",
  "2.1.1": "Keyboard",
  "2.1.2": "No Keyboard Trap",
  "2.4.1": "Bypass Blocks",
  "2.4.2": "Page Titled",
  "2.4.3": "Focus Order",
  "2.4.4": "Link Purpose (In Context)",
  "3.1.1": "Language of Page",
  "3.2.1": "On Focus",
  "3.2.2": "On Input",
  "3.3.1": "Error Identification",
  "3.3.2": "Labels or Instructions",
  "4.1.1": "Parsing",
  "4.1.2": "Name, Role, Value",

  // Level AA
  "1.3.4": "Orientation",
  "1.3.5": "Identify Input Purpose",
  "1.4.3": "Contrast (Minimum)",
  "1.4.4": "Resize Text",
  "1.4.10": "Reflow",
  "1.4.11": "Non-text Contrast",
  "1.4.12": "Text Spacing",
  "1.4.13": "Content on Hover or Focus",
  "2.4.5": "Multiple Ways",
  "2.4.6": "Headings and Labels",
  "2.4.7": "Focus Visible",
  "3.1.2": "Language of Parts",
  "3.2.3": "Consistent Navigation",
  "3.2.4": "Consistent Identification",
  "3.3.3": "Error Suggestion",
  "3.3.4": "Error Prevention (Legal, Financial, Data)",
  "4.1.3": "Status Messages",
} as const;
