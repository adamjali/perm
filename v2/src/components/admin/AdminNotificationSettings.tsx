"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { UserPlus, FolderPlus, FolderOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminNotificationSettingsProps {
  preferences: {
    adminNotifyNewUser: boolean;
    adminNotifyFirstCase: boolean;
    adminNotifyAnyCase: boolean;
  };
}

const NOTIFICATION_OPTIONS = [
  {
    key: "adminNotifyNewUser" as const,
    label: "New user signup",
    description: "Email when any user signs up",
    icon: UserPlus,
  },
  {
    key: "adminNotifyFirstCase" as const,
    label: "First case created",
    description: "Email when a user creates their first case",
    icon: FolderPlus,
  },
  {
    key: "adminNotifyAnyCase" as const,
    label: "Any case created",
    description: "Email when any case is created",
    icon: FolderOpen,
  },
] as const;

export function AdminNotificationSettings({ preferences }: AdminNotificationSettingsProps) {
  const savePrefs = useMutation(api.admin.saveAdminNotificationPreferences);
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (
    key: "adminNotifyNewUser" | "adminNotifyFirstCase" | "adminNotifyAnyCase",
    checked: boolean
  ) => {
    const previous = { ...localPrefs };
    const updated = { ...localPrefs, [key]: checked };
    setLocalPrefs(updated);
    setSaving(true);

    try {
      await savePrefs(updated);
    } catch (error) {
      setLocalPrefs(previous);
      console.error("Failed to save notification preferences:", error);
      toast.error("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Email Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_OPTIONS.map(({ key, label, description, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded border border-border bg-muted">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              id={key}
              checked={localPrefs[key]}
              onCheckedChange={(checked) => handleToggle(key, checked)}
              disabled={saving}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
