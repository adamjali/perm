"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ONBOARDING_ROLES } from "@/lib/onboarding/constants";
import type { UserRole } from "@/lib/onboarding/types";
import { BriefcaseIcon, BuildingIcon as Building2, QuestionIcon as HelpCircle, ScalesIcon as Scale, UserCheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { handleOperationError } from "@/lib/errors";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale,
  Briefcase: BriefcaseIcon,
  Building2,
  UserCheck: UserCheckIcon,
  HelpCircle,
};

interface RoleStepProps {
  onNext: () => void;
}

export function RoleStep({ onNext }: RoleStepProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const saveRole = useMutation(api.onboarding.saveOnboardingRole);

  const handleContinue = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      // Saved FIRST, then routed. The role is recorded either way, because
      // how many people pick this is the only measure of how much beneficiary
      // demand is landing in a tool built for someone else - and that number
      // is the input to whether a beneficiary product ever gets built.
      await saveRole({ role: selectedRole });

      // A beneficiary is sent to their case, not through the rest of this
      // wizard. The next steps are "create a case" and a caseload preview,
      // which are the wrong questions for the person the case is about: they
      // have one case, they did not file it, and they cannot edit it. Walking
      // them through a portfolio setup would be asking them to build a tool
      // for a job they do not have.
      if (selectedRole === "Waiting on my own case") {
        router.push("/perm-case-status");
        return;
      }
      onNext();
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to save role. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-1 text-center">
        What&apos;s your role?
      </h2>{" "}
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
                  : "border-border bg-card shadow-hard-sm hover:-translate-y-[2px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
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
                <p className="font-heading font-semibold text-sm">{role}</p>{" "}
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
