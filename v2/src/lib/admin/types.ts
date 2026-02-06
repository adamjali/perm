/**
 * Shared admin types used across admin UI components and utilities.
 */

import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Per-user summary returned by the admin dashboard query.
 * Used by UsersTable, ExportButton, and csvExport.
 */
export interface UserSummary {
  userId: Id<"users">;
  email: string;
  name: string;
  emailVerified: boolean;
  verificationMethod: string;
  authProviders: string[];
  accountCreated: number;
  lastLoginTime: number | null;
  totalLogins: number;
  totalCases: number;
  activeCases: number;
  deletedCases: number;
  lastCaseUpdate: number | null;
  userType: string;
  firmName: string | null;
  accountStatus: string;
  deletedAt: number | null;
  termsAccepted: number | null;
  termsVersion: string | null;
  lastActivity: number;
}
