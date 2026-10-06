/**
 * Shared admin types used across admin UI components and utilities.
 */

import type { Id } from "@convex/_generated/dataModel";
import type { Audience } from "@/lib/audience";

/**
 * Per-user summary returned by the admin dashboard query.
 * Used by UsersTable, ExportButton, and csvExport.
 */
export interface UserSummary {
  userId: Id<"users">;
  email: string;
  name: string;
  emailVerified: boolean;
  verificationMethod: "google" | "password_otp" | "no_auth_account" | "unverified";
  authProviders: string[];
  accountCreated: number;
  lastLoginTime: number | null;
  totalLogins: number;
  totalCases: number;
  activeCases: number;
  deletedCases: number;
  lastCaseUpdate: number | null;
  userType: "individual";
  accountStatus: "active" | "pending_deletion" | "deleted";
  deletedAt: number | null;
  termsAccepted: number | null;
  termsVersion: string | null;
  lastActivity: number;
  /** The role picked at onboarding or typed in Settings, as stored. */
  role: string | null;
  /** Who the account is for: practice, own case, other, or no role given. */
  audience: Audience;
}
