"use client";

import { DEFAULT_REMINDER_DAYS, DEFAULT_URGENT_DAYS } from "@convex/lib/userDefaults";
import { useState, useEffect, useCallback } from "react";
import { analytics } from "@/lib/analytics";
import { useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CaretDownIcon, CheckIcon, CircleNotchIcon, MinusIcon, PaperPlaneTiltIcon as Send, PlusIcon, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { MAIL_KINDS } from "@/lib/mailKinds";
import { SettingsCard } from "./SettingsCard";
import { ToneBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MailSubscriptionsCard } from "./MailSubscriptionsCard";
import { captureError } from "@/lib/sentry";
import {
  isPushSupported,
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSubscriptionStatus,
} from "@/lib/pushSubscription";

// ============================================================================
// CONSTANTS
// ============================================================================

const REMINDER_OPTIONS = DEFAULT_REMINDER_DAYS;
const MIN_URGENT_DAYS = 1;
const MAX_URGENT_DAYS = 30;

const DEADLINE_TYPES = [
  { key: "emailDeadlineReminderPwd", label: "PWD expiration", description: "Prevailing wage determination deadlines" },
  { key: "emailDeadlineReminderRecruitment", label: "Recruitment", description: "Job posting and recruitment deadlines" },
  { key: "emailDeadlineReminderEta9089", label: "ETA 9089", description: "Labor certification filing deadlines" },
  { key: "emailDeadlineReminderI140", label: "I-140", description: "Immigration petition filing deadlines" },
  { key: "emailDeadlineReminderRfi", label: "RFI response", description: "Request for information due dates" },
  { key: "emailDeadlineReminderRfe", label: "RFE response", description: "Request for evidence due dates" },
] as const;

type DeadlineTypeKey = typeof DEADLINE_TYPES[number]["key"];

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationPreferencesSectionProps {
  profile: {
    emailNotificationsEnabled?: boolean;
    emailDeadlineReminders?: boolean;
    emailDeadlineReminderPwd?: boolean;
    emailDeadlineReminderRecruitment?: boolean;
    emailDeadlineReminderEta9089?: boolean;
    emailDeadlineReminderI140?: boolean;
    emailDeadlineReminderRfi?: boolean;
    emailDeadlineReminderRfe?: boolean;
    emailStatusUpdates?: boolean;
    emailWeeklyDigest?: boolean;
    pushNotificationsEnabled?: boolean;
    reminderDaysBefore?: number[];
    urgentDeadlineDays?: number;
  };
  userEmail: string;
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indented?: boolean;
}

/** A setting and its switch. Off-limits rows stay readable, in muted ink. */
function ToggleRow({
  id, label, description, checked, onCheckedChange,
  disabled = false, indented = false,
}: ToggleRowProps): React.ReactElement {
  return (
    <div className={cn("flex items-center justify-between gap-4", indented && "ml-2 border-l border-border pl-4")}>
      <div className="flex-1 space-y-0.5">
        <Label htmlFor={id} className={cn("text-sm font-medium", disabled && "text-muted-foreground")}>
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

interface WarningBannerProps {
  visible: boolean;
  children: React.ReactNode;
  variant?: "warning" | "muted";
}

function WarningBanner({ visible, children, variant = "warning" }: WarningBannerProps): React.ReactElement | null {
  const styles = variant === "warning"
    ? "bg-data-warn/15 border-data-warn text-data-warn-ink"
    : "bg-muted border-border text-muted-foreground";

  if (!visible) return null;
  return (
    <div className={cn("flex items-center gap-2 border px-3 py-2 text-sm", styles)}>
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

interface TestButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  justSent: boolean;
  label: string;
  sentLabel?: string;
}

function TestButton({ onClick, disabled, loading, justSent, label, sentLabel = "Sent" }: TestButtonProps): React.ReactElement {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled} loading={loading} loadingText="Sending...">
      {justSent ? (
        <CheckIcon className="size-4 text-primary-text" aria-hidden="true" />
      ) : (
        <Send className="size-4" aria-hidden="true" />
      )}
      {justSent ? sentLabel : label}
    </Button>
  );
}

// ============================================================================
// PUSH STATUS BADGE
// ============================================================================

interface PushStatusBadgeProps {
  status: PushSubscriptionStatus | null;
  enabled: boolean;
}

function PushStatusBadge({ status, enabled }: PushStatusBadgeProps): React.ReactElement {
  if (!status?.supported) return <ToneBadge tone="flat">Not supported</ToneBadge>;
  if (status.permission === "denied") return <ToneBadge tone="bad">Blocked</ToneBadge>;
  if (enabled && status.subscribed) return <ToneBadge tone="good">Enabled</ToneBadge>;
  return <ToneBadge tone="flat">Disabled</ToneBadge>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotificationPreferencesSection({
  profile,
  userEmail,
}: NotificationPreferencesSectionProps): React.ReactElement {
  // Email toggles state
  const [emailEnabled, setEmailEnabled] = useState(profile.emailNotificationsEnabled ?? true);
  const [deadlineReminders, setDeadlineReminders] = useState(profile.emailDeadlineReminders ?? true);
  const [deadlineRemindersExpanded, setDeadlineRemindersExpanded] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState(profile.emailStatusUpdates ?? false);
  const [weeklyDigest, setWeeklyDigest] = useState(profile.emailWeeklyDigest ?? true);

  // Marketing email subscription (Resend Audiences)
  const [marketingSubscribed, setMarketingSubscribed] = useState<boolean | null>(null);
  const [marketingLoading, setMarketingLoading] = useState(true);
  const getMarketingStatus = useAction(api.marketingEmail.getMarketingSubscriptionStatus);
  const updateMarketingSub = useAction(api.marketingEmail.updateMarketingSubscription);

  useEffect(() => {
    if (!userEmail) { setMarketingLoading(false); return; }
    getMarketingStatus({ email: userEmail })
      .then((status) => { setMarketingSubscribed(status); setMarketingLoading(false); })
      .catch((err) => { console.error("[MarketingToggle] Failed to fetch status:", err); setMarketingLoading(false); });
  }, [userEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarketingToggle = useCallback(async (value: boolean) => {
    setMarketingSubscribed(value);
    try {
      await updateMarketingSub({ email: userEmail, subscribed: value });
      toast.success(value ? "Subscribed to product updates" : "Unsubscribed from product updates");
    } catch (error) {
      setMarketingSubscribed(!value);
      captureError(error, { operation: "updateMarketingSubscription" });
      toast.error("Couldn’t update the subscription. Try again.");
    }
  }, [updateMarketingSub, userEmail]);

  // Deadline type states (consolidated into object)
  const [deadlineTypes, setDeadlineTypes] = useState<Record<DeadlineTypeKey, boolean>>({
    emailDeadlineReminderPwd: profile.emailDeadlineReminderPwd ?? true,
    emailDeadlineReminderRecruitment: profile.emailDeadlineReminderRecruitment ?? true,
    emailDeadlineReminderEta9089: profile.emailDeadlineReminderEta9089 ?? true,
    emailDeadlineReminderI140: profile.emailDeadlineReminderI140 ?? true,
    emailDeadlineReminderRfi: profile.emailDeadlineReminderRfi ?? true,
    emailDeadlineReminderRfe: profile.emailDeadlineReminderRfe ?? true,
  });

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(profile.pushNotificationsEnabled ?? false);
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus | null>(null);
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);

  // Test states
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [justSentTestEmail, setJustSentTestEmail] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [justSentTestPush, setJustSentTestPush] = useState(false);

  // Reminder settings state
  const [reminderDays, setReminderDays] = useState<number[]>(() => {
    if (profile.reminderDaysBefore && profile.reminderDaysBefore.length > 0) {
      return profile.reminderDaysBefore.map(n => Number(n));
    }
    return [...DEFAULT_REMINDER_DAYS];
  });
  const [urgentDays, setUrgentDays] = useState(() => {
    return profile.urgentDeadlineDays !== undefined ? Number(profile.urgentDeadlineDays) : DEFAULT_URGENT_DAYS;
  });
  const [isUpdatingUrgentDays, setIsUpdatingUrgentDays] = useState(false);

  // Mutations and actions
  const updateProfile = useMutation(api.users.updateUserProfile);
  const sendTestEmail = useAction(api.notificationActions.sendTestEmail);
  const savePushSubscription = useMutation(api.users.savePushSubscription);
  const removePushSubscription = useMutation(api.users.removePushSubscription);
  const sendTestPush = useAction(api.pushNotifications.sendTestPush);

  // Check push subscription status on mount
  useEffect(() => {
    if (isPushSupported()) {
      getPushSubscriptionStatus()
        .then(setPushStatus)
        .catch((error) => {
          console.error("Failed to get push subscription status:", error);
          setPushStatus({ supported: true, permission: "default", subscribed: false });
        });
    } else {
      setPushStatus({ supported: false, permission: "unsupported", subscribed: false });
    }
  }, []);

  // Generic toggle handler with optimistic update
  const handleToggle = useCallback(async (
    field: string,
    value: boolean,
    setLocal: (value: boolean) => void
  ): Promise<void> => {
    setLocal(value);
    try {
      await updateProfile({ [field]: value });
      analytics.capture("notification_preferences_updated", { field, value });
      toast.success("Settings updated");
    } catch (error) {
      setLocal(!value);
      console.error("Failed to update notification setting:", error);
      captureError(error, { operation: "updateNotificationSetting" });
      toast.error("Couldn’t save your settings. Try again.");
    }
  }, [updateProfile]);

  // Deadline type toggle handler
  const handleDeadlineTypeToggle = useCallback(async (key: DeadlineTypeKey, value: boolean): Promise<void> => {
    setDeadlineTypes(prev => ({ ...prev, [key]: value }));
    try {
      await updateProfile({ [key]: value });
      toast.success("Settings updated");
    } catch (error) {
      setDeadlineTypes(prev => ({ ...prev, [key]: !value }));
      console.error("Failed to update deadline type setting:", error);
      captureError(error, { operation: "updateDeadlineTypeSetting" });
      toast.error("Couldn’t save your settings. Try again.");
    }
  }, [updateProfile]);

  // Master email toggle handler
  const handleMasterToggle = useCallback(async (value: boolean): Promise<void> => {
    setEmailEnabled(value);
    try {
      await updateProfile({ emailNotificationsEnabled: value });
      toast.success(value ? "Email notifications enabled" : "Email notifications disabled");
    } catch (error) {
      setEmailEnabled(!value);
      console.error("Failed to update email notifications:", error);
      captureError(error, { operation: "toggleEmailNotifications" });
      toast.error("Couldn’t save your settings. Try again.");
    }
  }, [updateProfile]);

  // Push notification toggle handler
  const handlePushToggle = useCallback(async (value: boolean): Promise<void> => {
    if (!pushStatus?.supported) {
      toast.error("Push notifications aren’t supported in this browser");
      return;
    }
    if (pushStatus.permission === "denied") {
      toast.error("Push notifications are blocked. Please enable them in your browser settings.");
      return;
    }

    setIsUpdatingPush(true);
    try {
      if (value) {
        const subscription = await subscribeToPush();
        if (subscription) {
          await savePushSubscription({ subscription });
          setPushEnabled(true);
          toast.success("Push notifications enabled");
        }
      } else {
        await unsubscribeFromPush();
        await removePushSubscription();
        setPushEnabled(false);
        toast.success("Push notifications disabled");
      }
      const newStatus = await getPushSubscriptionStatus();
      setPushStatus(newStatus);
    } catch (error) {
      console.error("Failed to update push notifications:", error);
      captureError(error, { operation: "togglePushNotifications" });
      const errorMessage = error instanceof Error ? error.message : "Failed to update push settings";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingPush(false);
    }
  }, [pushStatus, savePushSubscription, removePushSubscription]);

  // Test email handler
  const handleSendTestEmail = useCallback(async (): Promise<void> => {
    setIsSendingTestEmail(true);
    try {
      await sendTestEmail({ email: userEmail });
      toast.success("Test email sent. Check your inbox.");
      setJustSentTestEmail(true);
      setTimeout(() => setJustSentTestEmail(false), 2000);
    } catch (error) {
      console.error("Failed to send test email:", error);
      captureError(error, { operation: "sendTestEmail" });
      toast.error("Couldn’t send the test email. Try again.");
    } finally {
      setIsSendingTestEmail(false);
    }
  }, [sendTestEmail, userEmail]);

  // Test push handler
  const handleSendTestPush = useCallback(async (): Promise<void> => {
    setIsSendingTestPush(true);
    try {
      await sendTestPush();
      toast.success("Test push notification sent");
      setJustSentTestPush(true);
      setTimeout(() => setJustSentTestPush(false), 2000);
    } catch (error) {
      console.error("Failed to send test push:", error);
      captureError(error, { operation: "sendTestPush" });
      const errorMessage = error instanceof Error ? error.message : "Failed to send test notification";
      toast.error(errorMessage);
    } finally {
      setIsSendingTestPush(false);
    }
  }, [sendTestPush]);

  // Reminder days change handler
  const handleReminderDayChange = useCallback(async (day: number, checked: boolean): Promise<void> => {
    let newDays: number[];
    if (checked) {
      newDays = [...reminderDays, day].sort((a, b) => a - b);
    } else {
      if (reminderDays.length === 1) {
        toast.error("At least one reminder day is required");
        return;
      }
      newDays = reminderDays.filter(d => d !== day);
    }

    const previousDays = reminderDays;
    setReminderDays(newDays);
    try {
      await updateProfile({ reminderDaysBefore: newDays });
      toast.success("Reminder days updated");
    } catch (error) {
      setReminderDays(previousDays);
      console.error("Failed to update reminder days:", error);
      captureError(error, { operation: "updateReminderDays" });
      toast.error("Couldn’t save the reminder days. Try again.");
    }
  }, [reminderDays, updateProfile]);

  // Urgent days change handler
  const handleUrgentDaysChange = useCallback(async (value: number): Promise<void> => {
    if (value < MIN_URGENT_DAYS || value > MAX_URGENT_DAYS || isNaN(value)) return;

    const previousValue = urgentDays;
    setUrgentDays(value);
    setIsUpdatingUrgentDays(true);
    try {
      await updateProfile({ urgentDeadlineDays: value });
      toast.success("Urgent threshold updated");
    } catch (error) {
      setUrgentDays(previousValue);
      console.error("Failed to update urgent threshold:", error);
      captureError(error, { operation: "updateUrgentThreshold" });
      toast.error("Couldn’t save the urgent threshold. Try again.");
    } finally {
      setIsUpdatingUrgentDays(false);
    }
  }, [urgentDays, updateProfile]);

  // Weekly digest toggle with undo toast
  const handleWeeklyDigestToggle = useCallback((value: boolean): void => {
    if (!value) {
      toast(`${MAIL_KINDS.digest.name} turned off`, {
        description: "It won’t arrive any more.",
        action: {
          label: "Undo",
          onClick: () => handleToggle("emailWeeklyDigest", true, setWeeklyDigest),
        },
      });
    }
    handleToggle("emailWeeklyDigest", value, setWeeklyDigest);
  }, [handleToggle]);

  return (
    <div className="space-y-8">
      {/* Email Notifications Section */}
      <SettingsCard title="Email notifications" description="Control which email notifications you receive">
        <div className="space-y-5">
          <ToggleRow
            id="email-notifications-enabled"
            label="Email notifications"
            description="Receive notifications via email"
            checked={emailEnabled}
            onCheckedChange={handleMasterToggle}
          />

          <WarningBanner visible={!emailEnabled}>
            All email notifications are turned off
          </WarningBanner>

          <div className="space-y-4 pt-2">
            {/* Deadline reminders, with the types they cover folded under them */}
            <div className="ml-2 border-l border-border pl-4">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setDeadlineRemindersExpanded(!deadlineRemindersExpanded)}
                  disabled={!emailEnabled}
                  aria-expanded={deadlineRemindersExpanded}
                  className="flex min-h-11 flex-1 items-start gap-2 text-left disabled:cursor-not-allowed"
                >
                  <CaretDownIcon
                    className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", !deadlineRemindersExpanded && "-rotate-90")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 space-y-0.5">
                    <span className={cn("block text-sm font-medium", !emailEnabled && "text-muted-foreground")}>
                      {MAIL_KINDS.reminders.name}
                    </span>{" "}
                    <span className="block text-sm text-muted-foreground">{MAIL_KINDS.reminders.what}</span>
                  </span>
                </button>
                <Switch
                  id="email-deadline-reminders"
                  aria-label={MAIL_KINDS.reminders.name}
                  checked={deadlineReminders}
                  onCheckedChange={(value) => handleToggle("emailDeadlineReminders", value, setDeadlineReminders)}
                  disabled={!emailEnabled}
                />
              </div>

              {deadlineRemindersExpanded && (
                <div className="mt-3 ml-6 space-y-3 border-l border-border pl-4">
                  <p className="text-sm text-muted-foreground">Which deadlines to remind you about:</p>
                  {DEADLINE_TYPES.map((type) => {
                    const isDisabled = !emailEnabled || !deadlineReminders;
                    return (
                      <ToggleRow
                        key={type.key}
                        id={type.key}
                        label={type.label}
                        description={type.description}
                        checked={deadlineTypes[type.key]}
                        onCheckedChange={(value) => handleDeadlineTypeToggle(type.key, value)}
                        disabled={isDisabled}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <ToggleRow
              id="email-status-updates"
              label={MAIL_KINDS.updates.name}
              description={MAIL_KINDS.updates.what}
              checked={statusUpdates}
              onCheckedChange={(value) => handleToggle("emailStatusUpdates", value, setStatusUpdates)}
              disabled={!emailEnabled}
              indented
            />

            <ToggleRow
              id="email-weekly-digest"
              label={MAIL_KINDS.digest.name}
              description={`${MAIL_KINDS.digest.when}: ${MAIL_KINDS.digest.what}`}
              checked={weeklyDigest}
              onCheckedChange={handleWeeklyDigestToggle}
              disabled={!emailEnabled}
              indented
            />
          </div>
        </div>

        {/* Marketing / Product Updates */}
        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="marketing-updates" className="text-sm font-medium">
                Product updates and announcements
              </Label>
              <p className="text-sm text-muted-foreground">
                Occasional emails about new features and improvements
              </p>
            </div>
            {marketingLoading ? (
              <CircleNotchIcon className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
            ) : marketingSubscribed === null ? (
              <span className="text-sm text-muted-foreground">Not available</span>
            ) : (
              <Switch
                id="marketing-updates"
                checked={marketingSubscribed}
                onCheckedChange={handleMarketingToggle}
              />
            )}
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Test email</p>{" "}
              <p className="text-sm text-muted-foreground">Send a test email to {userEmail}</p>
            </div>
            <TestButton
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail || !emailEnabled}
              loading={isSendingTestEmail}
              justSent={justSentTestEmail}
              label="Send test"
            />
          </div>
        </div>
      </SettingsCard>

      <MailSubscriptionsCard email={userEmail} />

      {/* Push Notifications Section */}
      <SettingsCard
        title="Push notifications"
        description="Receive notifications directly in your browser"
        headerRight={<PushStatusBadge status={pushStatus} enabled={pushEnabled} />}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <Label
                htmlFor="push-notifications-enabled"
                className={cn("text-sm font-medium", (!pushStatus?.supported || isUpdatingPush) && "text-muted-foreground")}
              >
                Push notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                {!pushStatus?.supported
                  ? "Push notifications aren’t supported in this browser"
                  : "Receive instant notifications in your browser"}
              </p>
            </div>
            <Switch
              id="push-notifications-enabled"
              checked={pushEnabled && pushStatus?.subscribed === true}
              onCheckedChange={handlePushToggle}
              disabled={!pushStatus?.supported || pushStatus?.permission === "denied" || isUpdatingPush}
            />
          </div>

          <WarningBanner visible={pushStatus?.permission === "denied"}>
            Push notifications are blocked. Enable them in your browser settings.
          </WarningBanner>

          <WarningBanner visible={pushStatus?.supported === false} variant="muted">
            Push notifications aren’t supported in this browser. Try using Chrome, Firefox, or Edge.
          </WarningBanner>
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Test push notification</p>{" "}
              <p className="text-sm text-muted-foreground">Send a test notification to this browser</p>
            </div>
            <TestButton
              onClick={handleSendTestPush}
              disabled={isSendingTestPush || !pushEnabled || !pushStatus?.subscribed}
              loading={isSendingTestPush}
              justSent={justSentTestPush}
              label="Send test"
            />
          </div>
        </div>
      </SettingsCard>

      {/* Reminder Settings Section */}
      <SettingsCard title="Reminder settings" description="Configure when you receive deadline reminders">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground">Remind me before deadlines</Label>
            <p className="text-sm text-muted-foreground mt-0.5 mb-3">
              Select which days before a deadline you want to receive reminders
            </p>
            <div className="flex flex-wrap gap-4">
              {REMINDER_OPTIONS.map((day) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={reminderDays.includes(day)}
                    onCheckedChange={(checked) => handleReminderDayChange(day, checked as boolean)}
                  />
                  <span className="text-sm">{day} {day === 1 ? "day" : "days"}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Label htmlFor="urgent-deadline-days" className="text-sm font-medium text-foreground">
              Urgent deadline threshold
            </Label>
            <p className="text-sm text-muted-foreground mt-0.5 mb-3">
              Mark deadlines as urgent when within this many days
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleUrgentDaysChange(urgentDays - 1)}
                disabled={urgentDays <= MIN_URGENT_DAYS || isUpdatingUrgentDays}
                loading={isUpdatingUrgentDays}
                aria-label="One day fewer"
              >
                <MinusIcon className="size-4" aria-hidden="true" />
              </Button>
              <Input
                id="urgent-deadline-days"
                type="number"
                min={MIN_URGENT_DAYS}
                max={MAX_URGENT_DAYS}
                value={urgentDays}
                onChange={(e) => handleUrgentDaysChange(parseInt(e.target.value, 10))}
                className="h-11 w-16 text-center"
                disabled={isUpdatingUrgentDays}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleUrgentDaysChange(urgentDays + 1)}
                disabled={urgentDays >= MAX_URGENT_DAYS || isUpdatingUrgentDays}
                loading={isUpdatingUrgentDays}
                aria-label="One day more"
              >
                <PlusIcon className="size-4" aria-hidden="true" />
              </Button>
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Urgent deadlines bypass quiet hours.</p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
