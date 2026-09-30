import { CaseFormSkeleton } from "@/components/forms/CaseFormSkeleton";
import { NewCaseHeading } from "./NewCaseHeading";

/**
 * The page as it will render, with only the form held as a skeleton: the same
 * frame (it used to add px-4 py-8 the page does not have, so the page jumped
 * 32px up and 16px sideways) and the page's real heading.
 */
export default function NewCaseLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" data-testid="new-case-loading">
      <NewCaseHeading />
      <CaseFormSkeleton />
    </div>
  );
}
