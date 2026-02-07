"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ONBOARDING_ROLES } from "@/lib/onboarding/constants";
import type { UserRole } from "@/lib/onboarding/types";
import {
  Scale,
  Briefcase,
  Building2,
  UserCheck,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale,
  Briefcase,
  Building2,
  UserCheck,
  HelpCircle,
};

interface RoleStepProps {
  onNext: () => void;
}

export function RoleStep({ onNext }: RoleStepProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveRole = useMutation(api.onboarding.saveOnboardingRole);

  const handleContinue = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      await saveRole({ role: selectedRole });
      onNext();
    } catch (error) {
      console.error("Failed to save role:", error);
      toast.error("Failed to save role. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-1 text-center">
        What&apos;s your role?
      </h2>
      <p className="text-muted-foreground text-sm mb-6 text-center">
        This helps us personalize your experience
      </p>

      <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {ONBOARDING_ROLES.map(({ role, description, icon }) => {
          const Icon = ICON_MAP[icon] ?? HelpCircle;
          const isSelected = selectedRole === role;

          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex items-start gap-3 p-4 min-h-[56px] border-2 text-left transition-all duration-150 cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 shadow-hard"
                  : "border-border bg-card shadow-hard-sm hover:-translate-y-[2px] hover:shadow-hard"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-10 h-10 flex items-center justify-center border-2",
                  isSelected
                    ? "bg-primary text-primary-foreground border-border"
                    : "bg-muted border-border"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-semibold text-sm">{role}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selectedRole}
        loading={isSaving}
        loadingText="Saving..."
        size="lg"
        className="w-full max-w-sm uppercase tracking-wider font-heading text-sm"
      >
        Continue
      </Button>
    </div>
  );
}
