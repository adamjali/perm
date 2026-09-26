import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/green-card-fees/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("green-card-fees");

export default function Embed() {
  return (
    <EmbedFrame slug="green-card-fees">
      <ToolPage />
    </EmbedFrame>
  );
}
