import { Fragment, useId, type ReactNode } from "react";

import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";

/**
 * ChoiceRow's look for a plain GET form that has to work before any script runs
 * (the sponsor finder): real radio buttons in a fieldset with a legend, each
 * drawn as a choice, the checked one lime. Uncontrolled, so the server's
 * rendered `defaultValue` is what submits.
 */
export function ChoiceRadios({
  legend,
  legendClassName = "block text-sm font-semibold",
  name,
  options,
  defaultValue,
  className,
}: {
  legend: ReactNode;
  legendClassName?: string;
  name: string;
  options: readonly { value: string; label: ReactNode }[];
  defaultValue: string;
  className?: string;
}) {
  const base = useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className={legendClassName}>{legend}</legend>{" "}
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <Fragment key={o.value}>
            <label
              htmlFor={`${base}-${i}`}
              className={cn(
                choiceVariants({ on: false }),
                "cursor-pointer has-[:checked]:bg-primary has-[:checked]:font-bold has-[:checked]:text-primary-foreground has-[:checked]:shadow-hard-sm has-[:checked]:hover:bg-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              )}
            >
              <input
                id={`${base}-${i}`}
                type="radio"
                name={name}
                value={o.value}
                defaultChecked={o.value === defaultValue}
                className="sr-only"
              />
              {o.label}
            </label>{" "}
          </Fragment>
        ))}
      </div>
    </fieldset>
  );
}
