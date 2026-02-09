"use client";

/**
 * ContentShowcase Component
 *
 * Featured content hub articles on the landing page.
 * 3 hardcoded editorial picks with neobrutalist card design.
 * Sits between FAQ and CTA sections.
 */

import Image from "next/image";
import { BookOpen, ArrowRight, Clock, Loader2 } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { NavLink, useNavigationContext } from "@/components/ui/nav-link";

interface FeaturedArticle {
  href: string;
  type: "Guide" | "Tutorial" | "Blog";
  typeColor: string;
  title: string;
  description: string;
  readingTime: string;
  image: string;
  imageAlt: string;
}

const articles: FeaturedArticle[] = [
  {
    href: "/guides/ultimate-perm-guide-2026",
    type: "Guide",
    typeColor: "bg-blue-500",
    title: "The Ultimate PERM Guide for Immigration Attorneys (2026)",
    description:
      "Strategic playbook covering SOC codes, wage levels, recruitment compliance, audit avoidance, and timeline optimization.",
    readingTime: "25 min read",
    image: "/images/content/perm-tracker-desk.png",
    imageAlt: "PERM Tracker laptop showing case dashboard with approved immigration documents",
  },
  {
    href: "/tutorials/getting-started",
    type: "Tutorial",
    typeColor: "bg-primary",
    title: "Getting Started with PERM Tracker",
    description:
      "Set up your account, create your first case, and start tracking deadlines in under 5 minutes.",
    readingTime: "5 min read",
    image: "/images/features/calendar-planning.jpg",
    imageAlt: "Calendar view showing PERM case deadlines and planning",
  },
  {
    href: "/blog/common-perm-audit-triggers",
    type: "Blog",
    typeColor: "bg-orange-500",
    title: "5 Common PERM Audit Triggers and How to Avoid Them",
    description:
      "The top reasons cases get audited — and the documentation strategies that keep you off the DOL's radar.",
    readingTime: "8 min read",
    image: "/images/hero/attorney-at-desk.jpg",
    imageAlt: "Immigration attorney reviewing PERM case documents at desk",
  },
];

function ArticleCard({ article }: { article: FeaturedArticle }) {
  const context = useNavigationContext();
  const isNavigating = context?.activeNavigation === article.href;

  return (
    <NavLink href={article.href} className="group block" showLoading={false}>
      <div className="relative h-full border-3 border-border bg-background shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
        {/* Loading overlay */}
        {isNavigating && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Featured image */}
        <div className="relative aspect-[16/9] overflow-hidden border-b-3 border-border">
          <Image
            src={article.image}
            alt={article.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Type badge overlaying image */}
          <div className="absolute bottom-3 left-3">
            <span
              className={`inline-block border-2 border-black px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-black shadow-[2px_2px_0_rgba(0,0,0,0.3)] ${article.typeColor}`}
            >
              {article.type}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="mb-2 font-heading text-lg font-bold leading-tight transition-colors duration-200 group-hover:text-primary">
            {article.title}
          </h3>
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {article.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {article.readingTime}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-primary transition-transform duration-200 group-hover:translate-x-1">
              Read
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </NavLink>
  );
}

export function ContentShowcase() {
  return (
    <section className="relative bg-muted">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-12 text-center sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Learn PERM
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Resources & Guides
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            Deep dives, tutorials, and strategic guides for immigration
            attorneys.
          </p>
        </ScrollReveal>

        {/* Article cards */}
        <ScrollReveal
          direction="up"
          stagger
          className="grid gap-8 md:grid-cols-3"
        >
          {articles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </ScrollReveal>

        {/* View all link */}
        <ScrollReveal direction="up" delay={0.3} className="mt-10 text-center">
          <NavLink
            href="/blog"
            className="inline-flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-foreground transition-colors duration-200 hover:text-primary"
          >
            View all articles
            <ArrowRight className="h-4 w-4" />
          </NavLink>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default ContentShowcase;
