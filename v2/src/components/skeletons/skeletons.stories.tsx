/**
 * Skeleton Utilities Storybook Stories
 *
 * Documents all shared skeleton components with various configurations.
 * Supports dark mode toggle via Storybook toolbar.
 *
 * Phase: 22/23 (Case Forms & Detail)
 * Created: 2025-12-27
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  FieldSkeleton,
  FormSectionSkeleton,
  SectionSkeleton,
  ToggleSkeleton,
  BreadcrumbSkeleton,
  PageTitleSkeleton,
  ButtonSkeleton,
  StickyFooterSkeleton,
} from "./index";
import { CaseFormSkeleton } from "@/components/forms/CaseFormSkeleton";

// ============================================================================
// FIELD SKELETON
// ============================================================================

const fieldMeta = {
  title: "Skeletons/FieldSkeleton",
  component: FieldSkeleton,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    labelWidth: {
      control: "select",
      options: ["w-16", "w-20", "w-24", "w-28", "w-32", "w-40"],
    },
    inputHeight: {
      control: "select",
      options: ["h-9", "h-10", "h-11", "h-12"],
    },
  },
} satisfies Meta<typeof FieldSkeleton>;

export default fieldMeta;
type FieldStory = StoryObj<typeof fieldMeta>;

export const DefaultField: FieldStory = {
  args: {},
  decorators: [(Story) => <div className="w-64"><Story /></div>],
};

export const ShortLabel: FieldStory = {
  args: { labelWidth: "w-16" },
  decorators: [(Story) => <div className="w-64"><Story /></div>],
};

export const LongLabel: FieldStory = {
  args: { labelWidth: "w-40" },
  decorators: [(Story) => <div className="w-64"><Story /></div>],
};

export const FieldGrid: FieldStory = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-xl">
      <FieldSkeleton labelWidth="w-28" />
      <FieldSkeleton labelWidth="w-32" />
      <FieldSkeleton labelWidth="w-24" />
      <FieldSkeleton labelWidth="w-36" />
    </div>
  ),
};

// ============================================================================
// FORM SECTION SKELETON
// ============================================================================

export const FormSection: StoryObj<typeof FormSectionSkeleton> = {
  render: () => (
    <div className="max-w-2xl">
      <FormSectionSkeleton titleWidth="w-48" inputCount={4} columns={2} />
    </div>
  ),
};

export const FormSectionThreeColumns: StoryObj<typeof FormSectionSkeleton> = {
  render: () => (
    <div className="max-w-3xl">
      <FormSectionSkeleton titleWidth="w-40" inputCount={6} columns={3} />
    </div>
  ),
};

export const FormSectionSingleColumn: StoryObj<typeof FormSectionSkeleton> = {
  render: () => (
    <div className="max-w-md">
      <FormSectionSkeleton titleWidth="w-32" inputCount={3} columns={1} />
    </div>
  ),
};

export const FormSectionWithCustomContent: StoryObj<typeof FormSectionSkeleton> = {
  render: () => (
    <div className="max-w-2xl">
      <FormSectionSkeleton titleWidth="w-36">
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full skeleton-pulse" />
              <div className="h-4 w-48 rounded-full skeleton-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldSkeleton labelWidth="w-24" />
            <FieldSkeleton labelWidth="w-28" />
          </div>
        </div>
      </FormSectionSkeleton>
    </div>
  ),
};

// ============================================================================
// SECTION SKELETON (Detail Page)
// ============================================================================

export const Section: StoryObj<typeof SectionSkeleton> = {
  render: () => (
    <div className="max-w-md">
      <SectionSkeleton rows={2} cols={2} />
    </div>
  ),
};

export const SectionWide: StoryObj<typeof SectionSkeleton> = {
  render: () => (
    <div className="max-w-2xl">
      <SectionSkeleton rows={3} cols={2} />
    </div>
  ),
};

export const SectionSingleColumn: StoryObj<typeof SectionSkeleton> = {
  render: () => (
    <div className="max-w-sm">
      <SectionSkeleton rows={3} cols={1} showAction={false} />
    </div>
  ),
};

// ============================================================================
// TOGGLE SKELETON
// ============================================================================

export const Toggle: StoryObj<typeof ToggleSkeleton> = {
  render: () => (
    <div className="max-w-sm">
      <ToggleSkeleton labelWidth="w-28" />
    </div>
  ),
};

export const ToggleList: StoryObj<typeof ToggleSkeleton> = {
  render: () => (
    <div className="max-w-sm space-y-4">
      <ToggleSkeleton labelWidth="w-28" />
      <ToggleSkeleton labelWidth="w-20" />
      <ToggleSkeleton labelWidth="w-36" />
    </div>
  ),
};

// ============================================================================
// BREADCRUMB SKELETON
// ============================================================================

export const Breadcrumb: StoryObj<typeof BreadcrumbSkeleton> = {
  render: () => <BreadcrumbSkeleton items={3} />,
};

export const BreadcrumbShort: StoryObj<typeof BreadcrumbSkeleton> = {
  render: () => <BreadcrumbSkeleton items={2} />,
};

export const BreadcrumbLong: StoryObj<typeof BreadcrumbSkeleton> = {
  render: () => <BreadcrumbSkeleton items={4} />,
};

// ============================================================================
// PAGE TITLE SKELETON
// ============================================================================

export const PageTitle: StoryObj<typeof PageTitleSkeleton> = {
  render: () => (
    <div className="max-w-lg">
      <PageTitleSkeleton showAccent showDescription />
    </div>
  ),
};

export const PageTitleNoAccent: StoryObj<typeof PageTitleSkeleton> = {
  render: () => (
    <div className="max-w-lg">
      <PageTitleSkeleton showAccent={false} showDescription />
    </div>
  ),
};

export const PageTitleNoDescription: StoryObj<typeof PageTitleSkeleton> = {
  render: () => (
    <div className="max-w-lg">
      <PageTitleSkeleton showAccent showDescription={false} />
    </div>
  ),
};

// ============================================================================
// BUTTON SKELETON
// ============================================================================

export const Button: StoryObj<typeof ButtonSkeleton> = {
  render: () => (
    <div className="flex items-center gap-4">
      <ButtonSkeleton size="sm" width="w-20" />
      <ButtonSkeleton size="default" width="w-24" />
      <ButtonSkeleton size="lg" width="w-28" />
    </div>
  ),
};

// ============================================================================
// STICKY FOOTER SKELETON
// ============================================================================

export const StickyFooter: StoryObj<typeof StickyFooterSkeleton> = {
  render: () => (
    <div className="relative h-24">
      <StickyFooterSkeleton className="absolute" />
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};

// ============================================================================
// CASE FORM SKELETON (Complete)
// ============================================================================

export const CaseForm: StoryObj<typeof CaseFormSkeleton> = {
  render: () => (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <BreadcrumbSkeleton items={3} />
        <PageTitleSkeleton showAccent showDescription />
        <CaseFormSkeleton showFooter={false} />
      </div>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};

export const CaseFormWithFooter: StoryObj<typeof CaseFormSkeleton> = {
  render: () => (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
      <div className="space-y-6">
        <BreadcrumbSkeleton items={3} />
        <PageTitleSkeleton showAccent showDescription />
        <CaseFormSkeleton showFooter />
      </div>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};

// ============================================================================
// COMPOSITION EXAMPLE: COMPLETE PAGE LAYOUT
// ============================================================================

export const CompleteFormPageLayout: StoryObj<typeof CaseFormSkeleton> = {
  render: () => (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <div className="space-y-6">
          {/* Breadcrumb */}
          <BreadcrumbSkeleton items={3} />

          {/* Page Title */}
          <PageTitleSkeleton showAccent showDescription />

          {/* Form */}
          <CaseFormSkeleton showFooter />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};
