import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/i140-trends/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 604800;

export const metadata = embedMetadata("i140-trends");

export default function Embed() {
  return (
    <EmbedFrame slug="i140-trends">
      <ToolPage />
    </EmbedFrame>
  );
}
