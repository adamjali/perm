import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/perm-queue/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 21600;

export const metadata = embedMetadata("perm-queue");

export default function Embed() {
  return (
    <EmbedFrame slug="perm-queue">
      <ToolPage />
    </EmbedFrame>
  );
}
