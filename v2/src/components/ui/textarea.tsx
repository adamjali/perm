import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // min-w-0: a form control defaults to min-width:auto as a grid or flex
          // child, so its intrinsic width can push it past the track.
          // Same frame, focus and disabled treatment as <Input>.
          "flex min-h-[80px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base md:text-sm",
          "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
          "outline-none focus:shadow-hard focus:ring-2 focus:ring-ring focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "shadow-hard-sm transition-all duration-150 resize-vertical",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
