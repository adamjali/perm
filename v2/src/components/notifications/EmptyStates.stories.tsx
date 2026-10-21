import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState as PageEmpty } from "./NotificationList";
import { EmptyState as DropdownEmpty } from "./NotificationDropdown";

/** The two places an account with no notifications lands: the notifications page and the header's dropdown. */
const meta = {
  title: "Empty states/Notifications",
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Page: Story = {
  render: () => (
    <div className="max-w-xl">
      <PageEmpty activeTab="all" />
    </div>
  ),
};

export const Dropdown: Story = {
  render: () => (
    <div className="w-80 border-2 border-border bg-card">
      <DropdownEmpty />
    </div>
  ),
};
