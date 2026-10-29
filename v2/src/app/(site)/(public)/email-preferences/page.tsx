import { EmailPreferencesPage, emailPreferencesMetadata } from "./EmailPreferencesPage";

/** /email-preferences in English. The other languages render the same page under /<lang>/. */
export const metadata = emailPreferencesMetadata("en");

export default function Page() {
  return <EmailPreferencesPage lang="en" />;
}
