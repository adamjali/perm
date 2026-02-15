"use client";

/**
 * VideoShowcase Component
 *
 * Embeds the PERMExplainer Remotion video on the landing page.
 * Neobrutalist frame with header and ScrollReveal entrance.
 */

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { Play } from "lucide-react";
import VideoPlayer from "@/components/content/VideoPlayer";

export function VideoShowcase() {
  return (
    <section className="relative bg-muted">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 sm:py-28">
        <ScrollReveal direction="up" className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Play className="h-3.5 w-3.5" />
            Watch: The PERM Process
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            See How It Works in 20 Seconds
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            From case creation to deadline tracking — watch the entire PERM workflow.
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.15} className="mx-auto mt-12 max-w-4xl">
          {/* Neobrutalist video frame */}
          <div className="border-3 border-border shadow-hard overflow-hidden">
            {/* Mini browser chrome */}
            <div className="flex items-center gap-1.5 border-b-2 border-border bg-foreground px-3 py-1.5">
              <div className="h-2 w-2 bg-[#FF5F57]" />
              <div className="h-2 w-2 bg-[#FFBD2E]" />
              <div className="h-2 w-2 bg-[#28CA41]" />
              <span className="ml-2 font-mono text-[9px] text-background/50">
                PERM Explainer
              </span>
            </div>
            <VideoPlayer videoId="PERMExplainer" className="border-0 shadow-none" autoPlay loop />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default VideoShowcase;
