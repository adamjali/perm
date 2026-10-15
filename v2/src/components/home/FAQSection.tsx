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
import Link from "next/link";
import { ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
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
        "relative bg-card",
        "transition-colors duration-150",
        // A short ease-out
        "[transition-timing-function:cubic-bezier(0.165,0.84,0.44,1)]",
        isOpen
          ? ""
          : ""
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

        {/* Chevron: turns when the answer opens */}
        <div
          className={cn(
            "shrink-0 transition-transform duration-200 ease-out",
            isOpen && "rotate-180"
          )}
        >
          <CaretDownIcon className="h-5 w-5" aria-hidden="true" />
        </div>
      </button>

      {/* Answer content - expandable */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          "grid transition-colors duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div ref={contentRef} className="overflow-hidden">
          <div className="px-5 pb-5">
            <p className="text-base leading-7 text-soft">
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
    <section id="faq" aria-labelledby="faq-h" className="relative bg-tint py-12 sm:py-16">
      {/* Two columns from lg: the heading and the way to every other
          question on the left, the answers on the right. */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 [&>*]:min-w-0 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
        <div>
          <h2 id="faq-h" className="font-heading text-2xl font-bold sm:text-3xl">
            Questions about PERM Tracker
          </h2>{" "}
          <p className="mt-3 max-w-sm text-base leading-relaxed text-soft sm:text-lg">
            About the site and the app. How PERM itself works has its own page.
          </p>{" "}
          <Link
            href="/faq"
            className="link mt-5 inline-flex min-h-11 items-center gap-2"
          >
            Every question about PERM
            <ArrowRightIcon size={18} weight="bold" aria-hidden="true" />
          </Link>
        </div>{" "}
        <div className="flex flex-col gap-2">
          {HOME_FAQS.map((item, index) => (
            <FAQAccordionItem
              key={index}
              item={item}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

