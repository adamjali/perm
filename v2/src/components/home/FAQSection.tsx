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

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What exactly does PERM Tracker do?",
    answer:
      "PERM Tracker automates the deadline management for PERM labor certification cases. Enter your case dates, and it auto-calculates every critical deadline — PWD expiration, the 30-180 day ETA 9089 filing window, I-140 filing cutoffs, and more. You get email and push notifications before deadlines hit, plus Google Calendar sync so your whole team stays aligned.",
  },
  {
    question: "How is this different from using a spreadsheet?",
    answer:
      "Spreadsheets require manual deadline math, don't send reminders, and break when regulations change. PERM Tracker auto-calculates 15+ deadlines per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes. One missed formula in a spreadsheet can cost a client their green card.",
  },
  {
    question: "Is PERM Tracker really free?",
    answer:
      "Yes, completely free. No credit card, no trial period, no case limits. Immigration attorneys deserve quality tools without typical SaaS pricing. We may introduce optional premium features in the future, but the core tracking and deadline management will always be free.",
  },
  {
    question: "Is my client data secure?",
    answer:
      "Yes. We use industry-standard encryption, secure Google OAuth authentication, and row-level database security. Your data is isolated — no other firm can see your cases. We also offer Privacy Mode to hide sensitive information during screen sharing or presentations.",
  },
  {
    question: "Can I import my existing cases?",
    answer:
      "Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data anytime — your data is always yours.",
  },
  {
    question: "What happens if DOL changes regulations?",
    answer:
      "We monitor DOL regulatory changes and update our deadline calculation engine accordingly. When regulations change, your existing cases are recalculated automatically. You don't need to manually update formulas or check for rule changes.",
  },
];

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

        {/* Chevron icon - spring bounce rotation on open */}
        <div
          className={cn(
            "shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
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

        {/* FAQ accordion list - single stagger container */}
        <ScrollReveal direction="up" stagger className="flex flex-col gap-4">
          {faqItems.map((item, index) => (
            <FAQAccordionItem
              key={index}
              item={item}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}

export default FAQSection;
