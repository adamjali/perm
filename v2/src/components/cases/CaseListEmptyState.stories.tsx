import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CaseListEmptyState } from "./CaseListEmptyState";

/** The cases page before the first case, and after filters that match nothing. */
const meta = {
  title: "Empty states/Cases",
  component: CaseListEmptyState,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CaseListEmptyState>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NewAccount: Story = { args: { type: "new-user", onAddCase: () => {} } };
export const NoResults: Story = { args: { type: "no-results", onClearFilters: () => {} } };
