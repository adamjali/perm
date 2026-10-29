import { AlertsPage, alertsPageMetadata } from "./AlertsPage";

/** /perm-case-alerts in English. The other languages render the same page under /<lang>/. */
export const revalidate = 86400;

export const metadata = alertsPageMetadata("en");

export default function Page() {
  return <AlertsPage lang="en" />;
}
