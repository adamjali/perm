import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/compare-my-offer/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 604800;

export const metadata = embedMetadata("compare-offer");

export default function Embed() {
  return (
    <EmbedFrame slug="compare-offer">
      <ToolPage />
    </EmbedFrame>
  );
}
