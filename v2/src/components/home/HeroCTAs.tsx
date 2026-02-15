"use client";

import { Loader2, Rocket, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

export function HeroCTAs() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <div className="hero-entrance-item flex flex-wrap gap-4 pt-4">
      <MagneticButton>
        <Button
          size="lg"
          className="h-14 border-3 border-border px-8 font-heading text-base font-bold uppercase tracking-[0.05em] shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          onClick={() => navigateTo("/signup")}
          disabled={isNavigating}
        >
          {isNavigating && targetPath === "/signup" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-5 w-5" />
          )}
          Start Tracking Cases Free
        </Button>
      </MagneticButton>
      <MagneticButton>
        <Button
          variant="outline"
          size="lg"
          className="h-14 border-3 border-border bg-transparent px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-foreground shadow-hard transition-all duration-150 hover:bg-foreground hover:text-background hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:bg-[#404040] dark:border-[rgba(255,255,255,0.3)] dark:hover:bg-primary dark:hover:text-black dark:hover:border-primary"
          onClick={() => navigateTo("/demo")}
          disabled={isNavigating}
        >
          {isNavigating && targetPath === "/demo" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Play className="mr-2 h-5 w-5" />
          )}
          View Demo
        </Button>
      </MagneticButton>
    </div>
  );
}
