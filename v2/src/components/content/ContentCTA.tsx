"use client";

/**
 * ContentCTA
 *
 * Full-width call-to-action banner for content pages.
 * Matches the neobrutalist CTASection pattern from the home page.
 * GSAP parallax on decorative elements + FM stagger text.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { NavLink } from "@/components/ui/nav-link";
import { useParallax } from "@/lib/hooks/useGSAP";
import { stagger, fadeUp } from "@/lib/content/animations";

interface ContentCTAProps {
  title?: string;
  description?: string;
  buttonText?: string;
  href?: string;
}

export default function ContentCTA({
  title = "Start Tracking Your PERM Cases",
  description = "Free case management for immigration attorneys. Automated deadlines, recruitment tracking, and real-time case status.",
  buttonText = "Get Started Free",
  href = "/signup",
}: ContentCTAProps) {
  const decoRef = React.useRef<HTMLDivElement>(null);
  useParallax(decoRef, -0.1);

  return (
    <section className="relative overflow-hidden border-y-2 border-border bg-primary/5">
      {/* Decorative background shapes */}
      <div
        ref={decoRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute -left-20 -top-20 h-60 w-60 border-4 border-primary/10 rotate-12" />
        <div className="absolute -bottom-16 -right-16 h-48 w-48 bg-primary/5 -rotate-6" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <motion.div
          className="text-center"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          <motion.h2
            variants={fadeUp}
            className="mb-3 font-heading text-2xl font-bold sm:text-3xl"
          >
            {title}
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mb-6 max-w-xl text-muted-foreground"
          >
            {description}
          </motion.p>
          <motion.div variants={fadeUp}>
            <NavLink
              href={href}
              className="inline-block border-2 border-black bg-primary px-6 py-3 font-heading text-sm font-bold shadow-hard transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-white"
              style={{ color: "black" }}
              spinnerClassName="text-black"
              spinnerSize={14}
            >
              {buttonText}
            </NavLink>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
