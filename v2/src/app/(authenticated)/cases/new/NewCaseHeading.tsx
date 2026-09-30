"use client";

import { useRouter } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react";
import { PageHeading } from "../../components/PageHeading";

/**
 * The new-case page's breadcrumb and title. Shared with cases/new/loading.tsx
 * so the loading state shows the real heading: none of it depends on data.
 */
export function NewCaseHeading() {
  const router = useRouter();
  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => router.push("/cases")}
          className="hover:text-foreground transition-colors"
        >
          Cases
        </button>
        <CaretRightIcon className="size-4" />
        <span className="text-foreground font-medium">Add new case</span>
      </nav>

      {/* Page Title with neobrutalist accent */}
      <div className="relative">
        {/* Corner accent decoration */}
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary border-2 border-foreground shadow-hard-sm" />
        <div className="pl-6">
          <PageHeading
            title="Add new case"
            lede="Enter case details below. All fields are optional except employer, beneficiary, and position."
          />
        </div>
      </div>
    </>
  );
}
