"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "@/lib/toast";
import { Loader2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface SendEmailModalProps {
  user: {
    email: string;
    name: string;
  };
  onClose: () => void;
}

export function SendEmailModal({ user, onClose }: SendEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendEmail = useAction(api.admin.sendAdminEmail);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSending) return;

    // Validation
    if (!subject.trim()) {
      toast.error("Subject cannot be empty");
      return;
    }

    if (!body.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    setIsSending(true);

    try {
      await sendEmail({
        toEmail: user.email,
        subject: subject.trim(),
        body: body.trim(),
      });

      toast.success(`Email sent to ${user.email}`);
      onClose();
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide flex items-center gap-2">
            <Mail className="size-5" />
            Send Email
          </DialogTitle>
          <DialogDescription>
            Send an email to {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="to" className="text-sm font-bold uppercase tracking-wide">
              To
            </label>
            <Input
              id="to"
              type="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-bold uppercase tracking-wide">
              Subject
            </label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="body" className="text-sm font-bold uppercase tracking-wide">
              Message
            </label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter email message..."
              required
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This will be sent as a plain text email from notifications@permtracker.app
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
