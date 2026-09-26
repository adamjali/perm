import { LocalizedGuide, localizedGuideMetadata } from "@/components/i18n/LocalizedGuide";

// The vi version of the English guide (see src/lib/i18n/locales.ts). Daily,
// like the tools: it prints DOL's queue month and the newest bulletin.
export const revalidate = 86400;

export const metadata = localizedGuideMetadata("vi");

export default function Page() {
  return <LocalizedGuide code="vi" />;
}
