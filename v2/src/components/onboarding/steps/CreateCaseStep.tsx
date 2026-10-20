"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "../OnboardingProvider";
import { captureError } from "@/lib/sentry";
import { analytics } from "@/lib/analytics";
import { CalendarCheckIcon } from "@phosphor-icons/react";
import { carriedSummary, forgetCarried } from "@/lib/carriedCase";
import { carriedCaseFields } from "@/lib/carriedCaseFields";
import { useCarriedDates } from "@/hooks/useCarriedDates";

interface CreateCaseStepProps {
  onNext: () => void;
}

export function CreateCaseStep({ onNext }: CreateCaseStepProps) {
  const { setOnboardingCaseId, setOnboardingCaseInfo, completeChecklistItem } =
    useOnboarding();

  const [employerName, setEmployerName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [beneficiaryIdentifier, setBeneficiaryIdentifier] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCase = useMutation(api.cases.create);
  // Dates brought from the public deadline calculator (src/lib/carriedCase.ts):
  // this first case is saved with them, and its stage then follows them.
  const { dates: carried } = useCarriedDates();

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
        // The stage follows the dates (cases.create works it out); a stage
        // picked here was never stored, so none is asked for.
        caseStatus: "pwd",
        progressStatus: "working",
        ...(carried ? carriedCaseFields(carried) : {}),
      });
      if (carried) {
        forgetCarried();
        analytics.capture("carried_case_saved", { where: "onboarding", recruitment: Boolean(carried.first) });
      }

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
      captureError(error);
      const message = error instanceof Error ? error.message : "Failed to create case. Please try again.";
      setErrors({ form: message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-1 text-center">
        Create your first case
      </h2>{" "}
      <p className="text-muted-foreground text-sm mb-6 text-center">
        Just a few fields to get started. You can add details later.
      </p>

      {carried ? (
        <div className="mb-6 flex w-full max-w-sm items-start gap-3 border-2 border-border bg-tint p-3 text-sm">
          <CalendarCheckIcon className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden="true" />{" "}
          <p>
            From the deadline calculator: {carriedSummary(carried)}. They&rsquo;re saved with this case.
          </p>
        </div>
      ) : null}{" "}

      <div className="w-full max-w-sm space-y-4 mb-6">
        {/* Employer Name */}
        <div className="space-y-1.5">
          <Label htmlFor="onb-employer" className="font-heading font-semibold text-sm">
            Employer name <span className="text-destructive">*</span>
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
            <p className="text-sm text-destructive">{errors.employerName}</p>
          )}
        </div>

        {/* Position Title */}
        <div className="space-y-1.5">
          <Label htmlFor="onb-position" className="font-heading font-semibold text-sm">
            Position title <span className="text-destructive">*</span>
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
            <p className="text-sm text-destructive">{errors.positionTitle}</p>
          )}
        </div>

        {/* Beneficiary Identifier */}
        <div className="space-y-1.5">
          <Label htmlFor="onb-beneficiary" className="font-heading font-semibold text-sm">
            Beneficiary identifier{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="onb-beneficiary"
            value={beneficiaryIdentifier}
            onChange={(e) => setBeneficiaryIdentifier(e.target.value)}
            placeholder="e.g. initials or internal ID"
          />
          <p className="text-sm text-muted-foreground">
            A privacy-safe label to identify the beneficiary
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          The case&rsquo;s stage follows its dates, so there&rsquo;s no stage to pick.
        </p>
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
        className="w-full max-w-sm"
      >
        Create case
      </Button>
    </div>
  );
}
