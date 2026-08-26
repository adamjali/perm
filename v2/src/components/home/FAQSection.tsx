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
import { CaretDown, Question as HelpCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { HOME_FAQS, type HomeFaqItem } from "./faqData";



interface FAQAccordionItemProps {
  item: HomeFaqItem;
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
        "transition-all duration-150",
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
          "flex w-full items-center justify-between gap-4 p-5 text-left",
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
          <CaretDown className="h-5 w-5" aria-hidden="true" />
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
          <div className="border-t-2 border-border px-5 pb-5 pt-5">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-7">
              {item.rich}
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
    <section id="faq" className="relative py-16 sm:py-24">
      {/* Content container */}
      <div className="mx-auto max-w-[800px] px-4 sm:px-8">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-10 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            Common Questions
          </div>{" "}
          <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            FAQ
          </h2>
        </ScrollReveal>

        {/* FAQ accordion list - single stagger container */}
        <ScrollReveal direction="up" stagger className="flex flex-col gap-4">
          {HOME_FAQS.map((item, index) => (
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
