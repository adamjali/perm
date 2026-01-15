/**
 * AddCaseButton Component
 *
 * Primary action button to create a new case.
 *
 * Features:
 * - Navigates to /cases/new with loading state
 * - Plus icon + "Add New Case" text
 * - Neobrutalist styling: 4px border, hard shadow, Forest Green background
 * - Hover lift effect (up and left)
 * - Active press effect (down and right, shadow removal)
 * - Space Grotesk heading font, bold, uppercase
 * - Loading spinner during navigation
 *
 * Design: Neobrutalist with tactile, pressable feel
 */

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AddCaseButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      router.push("/cases/new");
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        // Base styling
        "inline-flex items-center justify-center gap-2 px-6 py-3",
        // Typography
        "font-heading font-bold uppercase text-sm tracking-wide",
        // Colors
        "bg-primary text-primary-foreground",
        // Neobrutalist border + shadow
        "border-4 border-black dark:border-white/20 shadow-hard",
        // No border radius (sharp corners)
        "rounded-none",
        // Cursor pointer for clickable state
        "cursor-pointer",
        // Hover: lift up-left (disabled when pending)
        !isPending && "hover:-translate-x-1 hover:-translate-y-1",
        // Active: press down-right, remove shadow (disabled when pending)
        !isPending && "active:translate-x-1 active:translate-y-1 active:shadow-none",
        // Loading state
        isPending && "opacity-80 cursor-wait",
        // Smooth transitions
        "transition-all duration-200"
      )}
    >
      {isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Plus className="size-5" />
      )}
      {isPending ? "Loading..." : "Add New Case"}
    </button>
  );
}
