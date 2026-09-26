import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/green-card-timeline/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 86400;

export const metadata = embedMetadata("green-card-timeline");

export default function Embed() {
  return (
    <EmbedFrame slug="green-card-timeline">
      <ToolPage />
    </EmbedFrame>
  );
}
