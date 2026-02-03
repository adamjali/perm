// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import NotificationList from "../NotificationList";
import type { Id } from "../../../../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

import { useQuery, useMutation } from "convex/react";

type NotificationType = "deadline_reminder" | "status_change" | "rfe_alert" | "rfi_alert" | "system" | "auto_closure";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface MockNotification {
  _id: Id<"notifications">;
  _creationTime: number;
  userId: Id<"users">;
  caseId?: Id<"cases">;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  emailSent: boolean;
  createdAt: number;
  updatedAt: number;
  caseInfo?: { employerName?: string; beneficiaryIdentifier?: string; caseStatus?: string } | null;
}

function createMockNotification(overrides?: Partial<MockNotification>): MockNotification {
  const now = Date.now();
  return {
    _id: `notification-${Math.random().toString(36).substring(7)}` as Id<"notifications">,
    _creationTime: now,
    userId: "user-123" as Id<"users">,
    type: "deadline_reminder",
    title: "Test Notification",
    message: "This is a test notification message",
    priority: "normal",
    isRead: false,
    emailSent: false,
    createdAt: now,
    updatedAt: now,
    caseInfo: null,
    ...overrides,
  };
}

function createNotificationsForDateGroups(): MockNotification[] {
  const now = Date.now();
  return [
    createMockNotification({ _id: "notif-today" as Id<"notifications">, title: "Today Notification", createdAt: now - 60 * 60 * 1000 }),
    createMockNotification({ _id: "notif-yesterday" as Id<"notifications">, title: "Yesterday Notification", createdAt: now - 24 * 60 * 60 * 1000 }),
    createMockNotification({ _id: "notif-this-week" as Id<"notifications">, title: "This Week Notification", createdAt: now - 3 * 24 * 60 * 60 * 1000 }),
    createMockNotification({ _id: "notif-this-month" as Id<"notifications">, title: "This Month Notification", createdAt: now - 14 * 24 * 60 * 60 * 1000 }),
    createMockNotification({ _id: "notif-older" as Id<"notifications">, title: "Older Notification", createdAt: now - 60 * 24 * 60 * 60 * 1000 }),
  ];
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2025-06-18T12:00:00.000Z"));
  vi.clearAllMocks();
  (useMutation as Mock).mockReturnValue(vi.fn().mockResolvedValue({ success: true }));
});

afterEach(() => vi.useRealTimers());

describe("NotificationList - Rendering", () => {
  it("renders loading skeleton when data is undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    const { container } = renderWithProviders(<NotificationList activeTab="all" />);
    expect(container.textContent).toBe('');
  });

  it("renders empty state when no notifications", () => {
    (useQuery as Mock).mockReturnValue({ notifications: [], hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("renders notification title, message, and case info", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [createMockNotification({
        title: "Deadline Approaching",
        message: "PWD expires in 30 days",
        caseInfo: { employerName: "Acme Corp", beneficiaryIdentifier: "John Doe" },
      })],
      hasMore: false, nextCursor: null,
    });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.getByText("Deadline Approaching")).toBeInTheDocument();
    expect(screen.getByText("PWD expires in 30 days")).toBeInTheDocument();
    expect(screen.getByText(/acme corp/i)).toBeInTheDocument();
    expect(screen.getByText(/john doe/i)).toBeInTheDocument();
  });
});

describe("NotificationList - Date Grouping", () => {
  it("groups notifications by date with correct headers", async () => {
    (useQuery as Mock).mockReturnValue({ notifications: createNotificationsForDateGroups(), hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab="all" />);
    await waitFor(() => expect(screen.getByText("Today")).toBeInTheDocument());
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
  });

  it("does not render empty groups", async () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [createMockNotification({ title: "Today Only", createdAt: Date.now() - 60 * 60 * 1000 })],
      hasMore: false, nextCursor: null,
    });
    renderWithProviders(<NotificationList activeTab="all" />);
    await waitFor(() => expect(screen.getByText("Today")).toBeInTheDocument());
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
    expect(screen.queryByText("This Week")).not.toBeInTheDocument();
  });
});

describe("NotificationList - Empty States", () => {
  it.each([
    ["all", /^no notifications$/i, /all caught up/i],
    ["unread", /no unread notifications/i, /read all your notifications/i],
    ["deadlines", /no deadline notifications/i, /no deadline reminders/i],
    ["status", /no status updates/i, /no case status changes/i],
    ["rfe_rfi", /no rfe\/rfi alerts/i, /no rfe or rfi alerts/i],
  ] as const)("shows correct %s empty message", (tab, titlePattern, descPattern) => {
    (useQuery as Mock).mockReturnValue({ notifications: [], hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab={tab} />);
    expect(screen.getByText(titlePattern)).toBeInTheDocument();
    expect(screen.getByText(descPattern)).toBeInTheDocument();
  });
});

describe("NotificationList - Pagination", () => {
  it("shows Load More when hasMore is true, hides when false", () => {
    (useQuery as Mock).mockReturnValue({ notifications: [createMockNotification()], hasMore: true, nextCursor: "123" });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("hides Load More when hasMore is false", () => {
    (useQuery as Mock).mockReturnValue({ notifications: [createMockNotification()], hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });
});

describe("NotificationList - Action Buttons", () => {
  it("shows mark as read for unread, hides for read", () => {
    (useQuery as Mock).mockReturnValue({ notifications: [createMockNotification({ isRead: false })], hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.getByRole("button", { name: /mark as read/i })).toBeInTheDocument();
  });

  it("hides mark as read for read notifications", () => {
    (useQuery as Mock).mockReturnValue({ notifications: [createMockNotification({ isRead: true })], hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.queryByRole("button", { name: /mark as read/i })).not.toBeInTheDocument();
  });

  it("calls markAsRead mutation when clicked", async () => {
    const mockMarkAsRead = vi.fn().mockResolvedValue({ success: true });
    (useMutation as Mock).mockReturnValue(mockMarkAsRead);
    (useQuery as Mock).mockReturnValue({
      notifications: [createMockNotification({ _id: "notif-123" as Id<"notifications">, isRead: false })],
      hasMore: false, nextCursor: null,
    });
    const { user } = renderWithProviders(<NotificationList activeTab="all" />);
    await user.click(screen.getByRole("button", { name: /mark as read/i }));
    expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationId: "notif-123" });
  });

  it("calls deleteNotification mutation when clicked", async () => {
    const mockDelete = vi.fn().mockResolvedValue({ success: true });
    (useMutation as Mock).mockReturnValue(mockDelete);
    (useQuery as Mock).mockReturnValue({
      notifications: [createMockNotification({ _id: "notif-456" as Id<"notifications">, isRead: true })],
      hasMore: false, nextCursor: null,
    });
    const { user } = renderWithProviders(<NotificationList activeTab="all" />);
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(mockDelete).toHaveBeenCalledWith({ notificationId: "notif-456" });
  });
});

describe("NotificationList - Navigation", () => {
  it("notification item is clickable", () => {
    (useQuery as Mock).mockReturnValue({ notifications: [createMockNotification()], hasMore: false, nextCursor: null });
    renderWithProviders(<NotificationList activeTab="all" />);
    expect(screen.getByRole("button", { name: /test notification/i })).toBeInTheDocument();
  });
});
