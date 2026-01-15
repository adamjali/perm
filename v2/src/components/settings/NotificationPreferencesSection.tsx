"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail, Bell, BellRing, AlertTriangle, Check, Send, Smartphone, Clock,
  Minus, Plus, ChevronDown, FileText, Briefcase, Calendar, FileCheck,
  HelpCircle, AlertCircle, Newspaper, LucideIcon,
} from "lucide-react";
import { toast } from "@/lib/toast";
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

const REMINDER_OPTIONS = [1, 3, 7, 14, 30] as const;
const DEFAULT_REMINDER_DAYS = [7, 14, 30];
const DEFAULT_URGENT_DAYS = 7;
const MIN_URGENT_DAYS = 1;
const MAX_URGENT_DAYS = 30;

const DEADLINE_TYPES = [
  { key: "emailDeadlineReminderPwd", label: "PWD Expiration", description: "Prevailing wage determination deadlines", icon: FileText },
  { key: "emailDeadlineReminderRecruitment", label: "Recruitment", description: "Job posting and recruitment deadlines", icon: Briefcase },
  { key: "emailDeadlineReminderEta9089", label: "ETA 9089", description: "Labor certification filing deadlines", icon: Calendar },
  { key: "emailDeadlineReminderI140", label: "I-140", description: "Immigration petition filing deadlines", icon: FileCheck },
  { key: "emailDeadlineReminderRfi", label: "RFI Response", description: "Request for information due dates", icon: HelpCircle },
  { key: "emailDeadlineReminderRfe", label: "RFE Response", description: "Request for evidence due dates", icon: AlertCircle },
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
  icon?: React.ReactNode;
  indented?: boolean;
}

function ToggleRow({
  id, label, description, checked, onCheckedChange,
  disabled = false, icon, indented = false,
}: ToggleRowProps): React.ReactElement {
  return (
    <div className={`flex items-center justify-between ${indented ? "ml-6 pl-4 border-l-2 border-border" : ""}`}>
      <div className="space-y-0.5 flex-1">
        <Label htmlFor={id} className={`text-sm font-medium flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
          {icon}
          {label}
        </Label>
        <p className={`text-xs text-muted-foreground ${disabled ? "opacity-50" : ""}`}>
          {description}
        </p>
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
    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
    : "bg-muted border-border text-muted-foreground";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className={`flex items-center gap-2 px-3 py-2 border-2 text-sm ${styles}`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{children}</span>
        </motion.div>
      )}
    </AnimatePresence>
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

function TestButton({ onClick, disabled, loading, justSent, label, sentLabel = "Sent!" }: TestButtonProps): React.ReactElement {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled} loading={loading} loadingText="Sending...">
      <AnimatePresence mode="wait">
        {justSent ? (
          <motion.span key="sent" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
            <Check className="w-4 h-4 text-primary" />
          </motion.span>
        ) : (
          <motion.span key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Send className="w-4 h-4" />
          </motion.span>
        )}
      </AnimatePresence>
      {justSent ? sentLabel : label}
    </Button>
  );
}

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, description, headerRight, children }: SectionCardProps): React.ReactElement {
  return (
    <div className="bg-card border-2 border-black dark:border-white/20 p-6" style={{ boxShadow: "4px 4px 0px #000" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-foreground" />
          <h3 className="font-heading font-bold text-lg text-foreground">{title}</h3>
        </div>
        {headerRight}
      </div>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      {children}
    </div>
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
  if (!status?.supported) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">Not Supported</span>;
  }
  if (status.permission === "denied") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">Blocked</span>;
  }
  if (enabled && status.subscribed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Enabled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Disabled
    </span>
  );
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
  const [statusUpdates, setStatusUpdates] = useState(profile.emailStatusUpdates ?? true);
  const [weeklyDigest, setWeeklyDigest] = useState(profile.emailWeeklyDigest ?? true);

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
    return DEFAULT_REMINDER_DAYS;
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
      toast.success("Settings updated");
    } catch (error) {
      setLocal(!value);
      console.error("Failed to update notification setting:", error);
      toast.error("Failed to update settings");
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
      toast.error("Failed to update settings");
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
      toast.error("Failed to update settings");
    }
  }, [updateProfile]);

  // Push notification toggle handler
  const handlePushToggle = useCallback(async (value: boolean): Promise<void> => {
    if (!pushStatus?.supported) {
      toast.error("Push notifications are not supported in this browser");
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
      toast.success("Test email sent! Check your inbox.");
      setJustSentTestEmail(true);
      setTimeout(() => setJustSentTestEmail(false), 2000);
    } catch (error) {
      console.error("Failed to send test email:", error);
      toast.error("Failed to send test email. Please try again.");
    } finally {
      setIsSendingTestEmail(false);
    }
  }, [sendTestEmail, userEmail]);

  // Test push handler
  const handleSendTestPush = useCallback(async (): Promise<void> => {
    setIsSendingTestPush(true);
    try {
      await sendTestPush();
      toast.success("Test push notification sent!");
      setJustSentTestPush(true);
      setTimeout(() => setJustSentTestPush(false), 2000);
    } catch (error) {
      console.error("Failed to send test push:", error);
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
      toast.error("Failed to update reminder days");
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
      toast.error("Failed to update urgent threshold");
    } finally {
      setIsUpdatingUrgentDays(false);
    }
  }, [urgentDays, updateProfile]);

  // Weekly digest toggle with undo toast
  const handleWeeklyDigestToggle = useCallback((value: boolean): void => {
    if (!value) {
      toast("Weekly digest disabled", {
        description: "You will no longer receive Monday morning summaries.",
        action: {
          label: "Undo",
          onClick: () => handleToggle("emailWeeklyDigest", true, setWeeklyDigest),
        },
      });
    }
    handleToggle("emailWeeklyDigest", value, setWeeklyDigest);
  }, [handleToggle]);

  return (
    <div className="space-y-6">
      {/* Email Notifications Section */}
      <SectionCard icon={Mail} title="Email Notifications" description="Control which email notifications you receive">
        <div className="space-y-5">
          <ToggleRow
            id="email-notifications-enabled"
            label="Email Notifications"
            description="Receive notifications via email"
            checked={emailEnabled}
            onCheckedChange={handleMasterToggle}
            icon={<Bell className="w-4 h-4 text-primary" />}
          />

          <WarningBanner visible={!emailEnabled}>
            All email notifications are turned off
          </WarningBanner>

          <div className="space-y-4 pt-2">
            {/* Expandable Deadline Reminders Section */}
            <div className="ml-6 pl-4 border-l-2 border-border">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDeadlineRemindersExpanded(!deadlineRemindersExpanded)}
                  disabled={!emailEnabled}
                  className={`flex-1 flex items-center gap-2 text-left ${!emailEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${deadlineRemindersExpanded ? "rotate-0" : "-rotate-90"} ${!emailEnabled ? "opacity-50" : ""}`} />
                  <div className="space-y-0.5 flex-1">
                    <span className={`text-sm font-medium flex items-center gap-2 ${!emailEnabled ? "opacity-50" : ""}`}>
                      <BellRing className="w-4 h-4" />
                      Deadline Reminders
                    </span>
                    <p className={`text-xs text-muted-foreground ${!emailEnabled ? "opacity-50" : ""}`}>
                      Get notified about upcoming deadlines
                    </p>
                  </div>
                </button>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    id="email-deadline-reminders"
                    checked={deadlineReminders}
                    onCheckedChange={(value) => handleToggle("emailDeadlineReminders", value, setDeadlineReminders)}
                    disabled={!emailEnabled}
                  />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {deadlineRemindersExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mt-4 ml-6 pl-4 border-l-2 border-border/50 space-y-3 pb-1">
                      <p className="text-xs text-muted-foreground mb-2">
                        Choose which deadline types to receive reminders for:
                      </p>
                      {DEADLINE_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isChecked = deadlineTypes[type.key];
                        const isDisabled = !emailEnabled || !deadlineReminders;
                        return (
                          <div key={type.key} className="flex items-center justify-between">
                            <div className="space-y-0.5 flex-1">
                              <Label htmlFor={type.key} className={`text-sm font-medium flex items-center gap-2 ${isDisabled ? "opacity-50" : ""}`}>
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                {type.label}
                              </Label>
                              <p className={`text-xs text-muted-foreground ${isDisabled ? "opacity-50" : ""}`}>
                                {type.description}
                              </p>
                            </div>
                            <Switch
                              id={type.key}
                              checked={isChecked}
                              onCheckedChange={(value) => handleDeadlineTypeToggle(type.key, value)}
                              disabled={isDisabled}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ToggleRow
              id="email-status-updates"
              label="Status Updates"
              description="Get notified when case statuses change"
              checked={statusUpdates}
              onCheckedChange={(value) => handleToggle("emailStatusUpdates", value, setStatusUpdates)}
              disabled={!emailEnabled}
              indented
            />

            <ToggleRow
              id="email-weekly-digest"
              label="Weekly Digest"
              description="Receive a summary email every Monday morning"
              checked={weeklyDigest}
              onCheckedChange={handleWeeklyDigestToggle}
              disabled={!emailEnabled}
              icon={<Newspaper className="w-4 h-4" />}
              indented
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Test Email</p>
              <p className="text-xs text-muted-foreground">Send a test email to {userEmail}</p>
            </div>
            <TestButton
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail || !emailEnabled}
              loading={isSendingTestEmail}
              justSent={justSentTestEmail}
              label="Send Test"
            />
          </div>
        </div>
      </SectionCard>

      {/* Push Notifications Section */}
      <SectionCard
        icon={Smartphone}
        title="Push Notifications"
        description="Receive notifications directly in your browser"
        headerRight={<PushStatusBadge status={pushStatus} enabled={pushEnabled} />}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="push-notifications-enabled" className={`text-sm font-medium flex items-center gap-2 ${!pushStatus?.supported || isUpdatingPush ? "opacity-50" : ""}`}>
                <Bell className="w-4 h-4 text-primary" />
                Push Notifications
              </Label>
              <p className={`text-xs text-muted-foreground ${!pushStatus?.supported || isUpdatingPush ? "opacity-50" : ""}`}>
                {!pushStatus?.supported
                  ? "Push notifications are not supported in this browser"
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
            Push notifications are not supported in this browser. Try using Chrome, Firefox, or Edge.
          </WarningBanner>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Test Push Notification</p>
              <p className="text-xs text-muted-foreground">Send a test notification to this browser</p>
            </div>
            <TestButton
              onClick={handleSendTestPush}
              disabled={isSendingTestPush || !pushEnabled || !pushStatus?.subscribed}
              loading={isSendingTestPush}
              justSent={justSentTestPush}
              label="Send Test"
            />
          </div>
        </div>
      </SectionCard>

      {/* Reminder Settings Section */}
      <SectionCard icon={Clock} title="Reminder Settings" description="Configure when you receive deadline reminders">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground">Remind me before deadlines</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
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
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Mark deadlines as urgent when within this many days
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleUrgentDaysChange(urgentDays - 1)}
                disabled={urgentDays <= MIN_URGENT_DAYS || isUpdatingUrgentDays}
                loading={isUpdatingUrgentDays}
                className="h-9 w-9"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                id="urgent-deadline-days"
                type="number"
                min={MIN_URGENT_DAYS}
                max={MAX_URGENT_DAYS}
                value={urgentDays}
                onChange={(e) => handleUrgentDaysChange(parseInt(e.target.value, 10))}
                className="w-16 text-center"
                disabled={isUpdatingUrgentDays}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleUrgentDaysChange(urgentDays + 1)}
                disabled={urgentDays >= MAX_URGENT_DAYS || isUpdatingUrgentDays}
                loading={isUpdatingUrgentDays}
                className="h-9 w-9"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Urgent deadlines bypass quiet hours
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
