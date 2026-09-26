import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/rfi-deadline/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("rfi-deadline");

export default function Embed() {
  return (
    <EmbedFrame slug="rfi-deadline">
      <ToolPage />
    </EmbedFrame>
  );
}
