"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserEditModalProps {
  user: {
    userId: string;
    email: string;
    name: string;
    userType: string;
  };
  onClose: () => void;
}

export function UserEditModal({ user, onClose }: UserEditModalProps) {
  const [fullName, setFullName] = useState(user.name);
  const [userType, setUserType] = useState(user.userType);

  const updateUser = useMutation(api.admin.updateUserAdmin);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validation
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateUser({
        userId: user.userId as any,
        fullName: fullName.trim(),
        userType: userType as "individual" | "firm_admin" | "firm_member",
      });

      toast.success("User updated successfully");
      onClose();
    } catch (error) {
      console.error("Failed to update user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            Edit User
          </DialogTitle>
          <DialogDescription>
            Update user profile information for {user.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-bold uppercase tracking-wide">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-bold uppercase tracking-wide">
              Full Name
            </label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="userType" className="text-sm font-bold uppercase tracking-wide">
              User Type
            </label>
            <select
              id="userType"
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="h-11 w-full border-2 border-border bg-background px-3 py-1 text-sm shadow-hard-sm transition-all duration-150 outline-none hover:shadow-hard hover:-translate-y-[1px] focus:shadow-hard focus:ring-2 focus:ring-ring"
            >
              <option value="individual">Individual</option>
              <option value="firm_admin">Firm Admin</option>
              <option value="firm_member">Firm Member</option>
            </select>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
