import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/priority-date-retention/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("pd-retention");

export default function Embed() {
  return (
    <EmbedFrame slug="pd-retention">
      <ToolPage />
    </EmbedFrame>
  );
}
