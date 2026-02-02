import type { Metadata } from "next";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard | PERM Tracker",
  description: "Admin dashboard for managing users and system data",
};

export default function AdminPage() {
  return <AdminDashboardClient />;
}
