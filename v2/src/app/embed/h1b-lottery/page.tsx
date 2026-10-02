import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/h1b-lottery-odds-calculator/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("h1b-lottery");

export default function Embed() {
  return (
    <EmbedFrame slug="h1b-lottery">
      <ToolPage />
    </EmbedFrame>
  );
}
