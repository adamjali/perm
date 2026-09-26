import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/wage-levels/page";

// The tool's own page, framed (see EmbedFrame). It reads ?soc= like the page.
export const dynamic = "force-dynamic";

export const metadata = embedMetadata("wage-levels");

export default function Embed({ searchParams }: { searchParams: Promise<{ soc?: string }> }) {
  return (
    <EmbedFrame slug="wage-levels">
      <ToolPage searchParams={searchParams} />
    </EmbedFrame>
  );
}
