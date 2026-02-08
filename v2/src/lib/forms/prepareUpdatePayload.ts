/**
 * Convert undefined optional fields to null before sending to Convex mutations.
 *
 * When a user clears an optional field, the form produces `undefined`.
 * Convex strips `undefined` from args for `v.optional()` fields, making it
 * impossible for the backend to distinguish "not sent" from "explicitly cleared".
 *
 * By converting `undefined` → `null`, the backend receives `null` as an explicit
 * "clear this field" signal, while truly omitted fields remain absent.
 */
export function prepareUpdatePayload(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formData)) {
    payload[key] = value === undefined ? null : value;
  }
  return payload;
}
