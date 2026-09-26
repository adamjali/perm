import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/perm-timeline-calculator/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 86400;

export const metadata = embedMetadata("perm-timeline");

export default function Embed() {
  return (
    <EmbedFrame slug="perm-timeline">
      <ToolPage />
    </EmbedFrame>
  );
}
