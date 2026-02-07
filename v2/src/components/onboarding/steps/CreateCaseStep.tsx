"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERM_STAGES } from "@/lib/onboarding/constants";
import { useOnboarding } from "../OnboardingProvider";
import { cn } from "@/lib/utils";

interface CreateCaseStepProps {
  onNext: () => void;
}

export function CreateCaseStep({ onNext }: CreateCaseStepProps) {
  const { setOnboardingCaseId, setOnboardingCaseInfo, completeChecklistItem } =
    useOnboarding();

  const [employerName, setEmployerName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [beneficiaryIdentifier, setBeneficiaryIdentifier] = useState("");
  const [caseStatus, setCaseStatus] = useState<string>("pwd");
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCase = useMutation(api.cases.create);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!employerName.trim()) newErrors.employerName = "Employer name is required";
    if (!positionTitle.trim()) newErrors.positionTitle = "Position title is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    setIsCreating(true);
    try {
      const caseId = await createCase({
        employerName: employerName.trim(),
        positionTitle: positionTitle.trim(),
        beneficiaryIdentifier: beneficiaryIdentifier.trim() || undefined,
        caseStatus: caseStatus as "pwd" | "recruitment" | "eta9089" | "i140",
        progressStatus: "working",
      });

      setOnboardingCaseId(caseId);
      setOnboardingCaseInfo({
        employerName: employerName.trim(),
        positionTitle: positionTitle.trim(),
      });

      // Auto-complete checklist item
      await completeChecklistItem("create_case");

      onNext();
    } catch (error) {
      console.error("Failed to create case:", error);
      setErrors({ form: "Failed to create case. Please try again." });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-1 text-center">
        Create your first case
      </h2>
      <p className="text-muted-foreground text-sm mb-6 text-center">
        Just a few fields to get started. You can add details later.
      </p>

      <div className="w-full max-w-sm space-y-4 mb-6">
        {/* Employer Name */}
        <div className="space-y-1.5">
          <Label htmlFor="onb-employer" className="font-heading font-semibold text-sm">
            Employer Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onb-employer"
            value={employerName}
            onChange={(e) => {
              setEmployerName(e.target.value);
              if (errors.employerName) setErrors((p) => ({ ...p, employerName: "" }));
            }}
            placeholder="e.g. Acme Corp"
            aria-invalid={!!errors.employerName}
          />
          {errors.employerName && (
            <p className="text-xs text-destructive">{errors.employerName}</p>
          )}
        </div>

        {/* Position Title */}
        <div className="space-y-1.5">
          <Label htmlFor="onb-position" className="font-heading font-semibold text-sm">
            Position Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onb-position"
            value={positionTitle}
            onChange={(e) => {
              setPositionTitle(e.target.value);
              if (errors.positionTitle) setErrors((p) => ({ ...p, positionTitle: "" }));
            }}
            placeholder="e.g. Software Engineer"
            aria-invalid={!!errors.positionTitle}
          />
          {errors.positionTitle && (
            <p className="text-xs text-destructive">{errors.positionTitle}</p>
          )}
        </div>

        {/* Beneficiary Identifier */}
        <div className="space-y-1.5">
          <Label htmlFor="onb-beneficiary" className="font-heading font-semibold text-sm">
            Beneficiary Identifier{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="onb-beneficiary"
            value={beneficiaryIdentifier}
            onChange={(e) => setBeneficiaryIdentifier(e.target.value)}
            placeholder="e.g. initials or internal ID"
          />
          <p className="text-xs text-muted-foreground">
            A privacy-safe label to identify the beneficiary
          </p>
        </div>

        {/* Stage Selector */}
        <div className="space-y-1.5">
          <Label className="font-heading font-semibold text-sm">
            Current PERM Stage
          </Label>
          <div className="flex flex-wrap gap-2">
            {PERM_STAGES.map((stage) => (
              <button
                key={stage.value}
                type="button"
                onClick={() => setCaseStatus(stage.value)}
                className={cn(
                  "px-3 py-2.5 min-h-[44px] text-xs font-heading font-semibold uppercase tracking-wide border-2 transition-all duration-150 cursor-pointer",
                  caseStatus === stage.value
                    ? "border-border bg-primary text-primary-foreground shadow-hard-sm"
                    : "border-border bg-card text-foreground hover:-translate-y-[1px] hover:shadow-hard-sm"
                )}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errors.form && (
        <p className="text-sm text-destructive mb-4 text-center">{errors.form}</p>
      )}

      <Button
        onClick={handleCreate}
        disabled={isCreating}
        loading={isCreating}
        loadingText="Creating case..."
        size="lg"
        className="w-full max-w-sm uppercase tracking-wider font-heading text-sm"
      >
        Create Case
      </Button>
    </div>
  );
}
