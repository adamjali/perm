"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeSlash as EyeOff } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps
  extends Omit<ComponentProps<"input">, "type"> {
  /** Override the initial visibility state */
  defaultVisible?: boolean;
}

function PasswordInput({
  className,
  defaultVisible = false,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <div className="relative w-full">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        disabled={disabled}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className={cn(
          "absolute right-0 top-0 h-full w-11 inline-flex items-center justify-center",
          "text-muted-foreground transition-colors duration-150",
          "hover:text-foreground",
          "focus-visible:outline-none focus-visible:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
export type { PasswordInputProps };
