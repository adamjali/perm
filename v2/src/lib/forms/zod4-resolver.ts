/**
 * Custom Zod 4 Resolver for react-hook-form
 *
 * This resolver provides compatibility between Zod 4.x and react-hook-form.
 * The @hookform/resolvers package has known type compatibility issues with Zod 4,
 * so we implement a custom resolver that properly handles validation.
 *
 * @see https://github.com/react-hook-form/resolvers/issues/799
 */

import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodError } from "zod";

/**
 * Format Zod errors into react-hook-form compatible error format
 */
function formatZodErrors<T extends FieldValues>(zodError: ZodError): FieldErrors<T> {
  const errors: FieldErrors<T> = {};

  for (const issue of zodError.issues) {
    const path = issue.path.join(".");
    if (path) {
      // Navigate to the correct nested position
      const pathParts = issue.path;
      let current = errors as Record<string, unknown>;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = String(pathParts[i]);
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = String(pathParts[pathParts.length - 1]);
      current[lastPart] = {
        type: issue.code,
        message: issue.message,
      };
    }
  }

  return errors;
}

/**
 * Schema interface - minimal interface that Zod schemas satisfy
 */
interface ZodLikeSchema<TOutput> {
  parseAsync(data: unknown): Promise<TOutput>;
  safeParse(data: unknown): { success: true; data: TOutput } | { success: false; error: ZodError };
}

/**
 * Create a Zod 4 compatible resolver for react-hook-form
 *
 * Uses type assertion to bypass Zod 4's complex internal types.
 * The runtime behavior is correct; we're just working around TypeScript limitations.
 *
 * @param schema - Zod schema to validate against
 * @returns A resolver function compatible with react-hook-form's useForm
 *
 * @example
 * ```tsx
 * import { useForm } from "react-hook-form";
 * import { z } from "zod";
 * import { zod4Resolver } from "@/lib/forms/zod4-resolver";
 *
 * const schema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * });
 *
 * type FormData = z.infer<typeof schema>;
 *
 * function MyForm() {
 *   const { register, handleSubmit } = useForm<FormData>({
 *     resolver: zod4Resolver(schema),
 *   });
 *
 *   return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
 * }
 * ```
 */
export function zod4Resolver<TFormValues extends FieldValues>(
  schema: ZodLikeSchema<TFormValues>
): Resolver<TFormValues> {
  const resolver: Resolver<TFormValues> = async (values, _context, options) => {
    try {
      // Parse with Zod - Zod 4 uses parseAsync
      const result = await schema.parseAsync(values);

      // Success: return values with empty errors object
      return {
        values: result,
        errors: {} as Record<string, never>,
      };
    } catch (error) {
      // Handle Zod validation errors
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as ZodError;

        // Format errors
        const formattedErrors = formatZodErrors<TFormValues>(zodError);

        // If we have field names to validate specifically, filter errors
        if (options.names && options.names.length > 0) {
          const filteredErrors: FieldErrors<TFormValues> = {};
          for (const name of options.names) {
            const key = String(name);
            if (key in formattedErrors) {
              (filteredErrors as Record<string, unknown>)[key] = (
                formattedErrors as Record<string, unknown>
              )[key];
            }
          }
          return {
            values: {},
            errors: filteredErrors,
          };
        }

        return {
          values: {},
          errors: formattedErrors,
        };
      }

      // Re-throw unexpected errors
      throw error;
    }
  };

  return resolver;
}

/**
 * Synchronous version of the resolver (uses safeParse)
 * Use this when you know the schema doesn't have async refinements
 */
export function zod4ResolverSync<TFormValues extends FieldValues>(
  schema: ZodLikeSchema<TFormValues>
): Resolver<TFormValues> {
  const resolver: Resolver<TFormValues> = (values, _context, options) => {
    const result = schema.safeParse(values);

    if (result.success) {
      // Success: return values with empty errors object
      return {
        values: result.data,
        errors: {} as Record<string, never>,
      };
    }

    const formattedErrors = formatZodErrors<TFormValues>(result.error);

    // Filter by field names if specified
    if (options.names && options.names.length > 0) {
      const filteredErrors: FieldErrors<TFormValues> = {};
      for (const name of options.names) {
        const key = String(name);
        if (key in formattedErrors) {
          (filteredErrors as Record<string, unknown>)[key] = (
            formattedErrors as Record<string, unknown>
          )[key];
        }
      }
      return {
        values: {},
        errors: filteredErrors,
      };
    }

    return {
      values: {},
      errors: formattedErrors,
    };
  };

  return resolver;
}
