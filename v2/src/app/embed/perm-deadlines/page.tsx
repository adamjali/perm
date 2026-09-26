import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/perm-deadline-calculator/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("perm-deadlines");

export default function Embed() {
  return (
    <EmbedFrame slug="perm-deadlines">
      <ToolPage />
    </EmbedFrame>
  );
}
