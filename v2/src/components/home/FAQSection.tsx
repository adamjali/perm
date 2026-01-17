"use client";

/**
 * FAQSection Component
 *
 * Accordion-based FAQ section for the home page.
 * Features 6 common questions about PERM Tracker.
 * Single item open at a time (accordion behavior).
 *
 */

import * as React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ============================================================================
// FAQ DATA
// ============================================================================

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What is PERM and why do I need to track it?",
    answer:
      "PERM (Program Electronic Review Management) is the DOL's labor certification process for permanent employment-based immigration. Tracking is critical because there are strict deadlines—miss one and the entire application could be denied or require starting over. PERM Tracker automates deadline calculations and sends reminders so you never miss a filing window.",
  },
  {
    question: "How does deadline tracking work?",
    answer:
      "Based on DOL regulations (20 CFR 656.40), PERM Tracker automatically calculates all critical deadlines. This includes PWD expiration dates, the 30-180 day ETA 9089 filing window after recruitment ends, the 180-day I-140 filing deadline after PERM certification, and RFI response deadlines. You'll get notifications before each deadline approaches.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. We use industry-standard encryption, secure authentication, and row-level database security to protect your client data. We also offer Privacy Mode to hide sensitive information during screen sharing or presentations.",
  },
  {
    question: "Can I import existing cases?",
    answer:
      "Yes! PERM Tracker supports CSV import for bulk case uploads. You can also export your data anytime. The import wizard maps your fields automatically and validates data before import.",
  },
  {
    question: "How does the AI assistant work?",
    answer:
      'The AI assistant understands the entire PERM process. Ask questions in plain English like "What cases have deadlines this week?" or "Start a new case for John Smith at Acme Corp." It can search, filter, create, update, and explain—essentially anything you can do manually.',
  },
  {
    question: "Is PERM Tracker really free?",
    answer:
      "Yes, PERM Tracker is free to use. No credit card required to get started. Immigration attorneys deserve quality tools without the typical SaaS pricing. We may introduce optional premium features in the future.",
  },
];

// ============================================================================
// FAQ ITEM COMPONENT
// ============================================================================

interface FAQAccordionItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

function FAQAccordionItem({ item, isOpen, onToggle, index }: FAQAccordionItemProps) {
  const contentId = `faq-content-${index}`;
  const headerId = `faq-header-${index}`;
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        "relative border-3 border-border bg-background",
        "transition-all duration-200",
        // Cubic bezier for snappy neobrutalist feel
        "[transition-timing-function:cubic-bezier(0.165,0.84,0.44,1)]",
        isOpen
          ? "shadow-hard"
          : "shadow-hard hover:shadow-hard"
      )}
    >
      {/* Question header - clickable */}
      <button
        id={headerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-4 p-6 text-left",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "transition-colors duration-150 hover:bg-muted group"
        )}
      >
        <span className="font-heading text-base font-semibold tracking-tight sm:text-lg text-foreground">
          {item.question}
        </span>

        {/* Chevron icon - simple rotation on open */}
        <div
          className={cn(
            "shrink-0 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        >
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </div>
      </button>

      {/* Answer content - expandable */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          "grid transition-all duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div ref={contentRef} className="overflow-hidden">
          <div className="border-t-2 border-border px-6 pb-6 pt-6">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-7">
              {item.answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FAQSection() {
  // Only one item can be open at a time
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section id="faq" className="relative py-20 sm:py-32">
      {/* Content container */}
      <div className="mx-auto max-w-[800px] px-4 sm:px-8">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-12 text-center sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            Common Questions
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            FAQ
          </h2>
        </ScrollReveal>

        {/* FAQ accordion list */}
        <div className="flex flex-col gap-4">
          {faqItems.map((item, index) => (
            <ScrollReveal key={index} direction="up" delay={index * 0.05}>
              <FAQAccordionItem
                item={item}
                index={index}
                isOpen={openIndex === index}
                onToggle={() => handleToggle(index)}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FAQSection;
