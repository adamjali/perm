import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState, type ReactNode } from "react";
import { render } from "@react-email/render";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import type { DisplayMessage } from "@/hooks/useChatWithPersistence";
import { DeadlineDigest, type DeadlineDigestProps } from "@/emails/DeadlineDigest";
import { DashboardPageClient } from "../../app/(authenticated)/dashboard/DashboardPageClient";
import { CasesPageClient } from "../../app/(authenticated)/cases/CasesPageClient";
import { CaseDetailPageClient } from "../../app/(authenticated)/cases/[id]/CaseDetailPageClient";
import { EditCasePageClient } from "../../app/(authenticated)/cases/[id]/edit/EditCasePageClient";
import { CalendarPageClient } from "../../app/(authenticated)/calendar/CalendarPageClient";
import { NotificationsPageClient } from "../../app/(authenticated)/notifications/NotificationsPageClient";
import { TOUR_CASE_IDS, TourConvex } from "./fakeConvex";
import fixtures from "./tour-fixtures.json";

/**
 * The signed-in app's real pages, drawn from a sample firm's recorded data
 * (see fakeConvex.tsx). The attorney page's product pictures are captured from
 * these stories; scripts/tour_shots.py says how, and encodes them.
 */

const [, TIDEWATER, JUNIPER] = TOUR_CASE_IDS;

/**
 * The detail page reads its params with React's use(). A promise already
 * marked fulfilled is read at once, so the page never suspends on it.
 */
const JUNIPER_PARAMS = Object.assign(Promise.resolve({ id: JUNIPER! }), {
  status: "fulfilled" as const,
  value: { id: JUNIPER! },
});

/**
 * The signed-in layout's main column. The header is left out: it needs a live
 * sign-in session, and the pictures frame each page with its own address bar.
 */
function AppShell({ children }: { children: ReactNode }) {
  return (
    <TourConvex>
      <AuthProvider>
        <OnboardingProvider>
          <div id="tour-capture" className="bg-background text-foreground">
            <main className="relative mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 break-words sm:px-8">{children}</main>
          </div>
        </OnboardingProvider>
      </AuthProvider>
    </TourConvex>
  );
}

type Stored = { _id: string; role: "user" | "assistant"; content: string; createdAt: number; toolCalls?: DisplayMessage["toolCalls"] };
const conversation = Object.entries(fixtures).find(([k]) => k.startsWith("conversationMessages:list "))?.[1] as Stored[] | undefined;
const MESSAGES: DisplayMessage[] = (conversation ?? []).map((m) => ({
  id: m._id,
  role: m.role,
  content: m.content,
  timestamp: m.createdAt,
  ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
}));

const meta = {
  title: "Tour/App pages",
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Dashboard: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } } },
  render: () => (
    <AppShell>
      <DashboardPageClient />
    </AppShell>
  ),
};

export const Cases: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/cases" } } },
  render: () => (
    <AppShell>
      <CasesPageClient />
    </AppShell>
  ),
};

export const CaseDetail: Story = {
  name: "Case detail",
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/cases/${JUNIPER}` } } },
  render: () => (
    <AppShell>
      <CaseDetailPageClient params={JUNIPER_PARAMS} />
    </AppShell>
  ),
};

export const EditCase: Story = {
  name: "Edit case",
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: `/cases/${TIDEWATER}/edit`, segments: [["id", TIDEWATER]] } },
  },
  render: () => (
    <AppShell>
      <EditCasePageClient />
    </AppShell>
  ),
};

export const Calendar: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/calendar" } } },
  render: () => (
    <AppShell>
      <CalendarPageClient />
    </AppShell>
  ),
};

export const Notifications: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/notifications" } } },
  render: () => (
    <AppShell>
      <NotificationsPageClient />
    </AppShell>
  ),
};

/** The assistant panel on its own, as it opens over a page. */
export const Assistant: Story = {
  render: () => (
    <TourConvex>
      <div id="tour-capture" className="h-[640px] w-[420px] bg-background">
        <ChatPanel messages={MESSAGES} input="" onInputChange={() => {}} onSend={() => {}} status="ready" onClose={() => {}} />
      </div>
    </TourConvex>
  ),
};

const DIGEST = (fixtures as Record<string, unknown>)["tour:digest"] as Pick<DeadlineDigestProps, "userName" | "items">;

/** Today's reminder email, rendered to HTML by the same renderer the sender uses. */
function DigestEmail() {
  const [html, setHtml] = useState("");
  useEffect(() => {
    void render(<DeadlineDigest userName={DIGEST.userName} items={DIGEST.items} />).then(setHtml);
  }, []);
  return (
    <div id="tour-capture" className="w-[640px] bg-white">
      {html ? <iframe title="Reminder email" srcDoc={html} className="block h-[900px] w-full border-0" /> : null}
    </div>
  );
}

export const ReminderEmail: Story = {
  name: "Reminder email",
  render: () => <DigestEmail />,
};
