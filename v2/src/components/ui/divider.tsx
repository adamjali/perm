import { cn } from "@/lib/utils"

interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  variant?: "default" | "thick"
}

function Divider({ className, variant = "default", ...props }: DividerProps) {
  return (
    <hr
      data-slot="divider"
      className={cn(
        "border-border w-full",
        variant === "default" && "border-t-2",
        variant === "thick" && "border-t-4",
        className
      )}
      {...props}
    />
  )
}

export { Divider }
