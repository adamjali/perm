import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/priority-date-calculator/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 86400;

export const metadata = embedMetadata("priority-date");

export default function Embed() {
  return (
    <EmbedFrame slug="priority-date">
      <ToolPage />
    </EmbedFrame>
  );
}
