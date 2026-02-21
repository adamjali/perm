"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  category: string;
  items: FAQItem[];
}

interface FAQPageClientProps {
  faqData: FAQSection[];
}

export function FAQPageClient({ faqData }: FAQPageClientProps) {
  const [openIndex, setOpenIndex] = React.useState<string | null>(null);

  const handleToggle = (key: string) => {
    setOpenIndex((current) => (current === key ? null : key));
  };

  return (
    <div className="space-y-10">
      {faqData.map((section) => (
        <div key={section.category}>
          <ScrollReveal direction="up">
            <h2 className="mb-4 font-heading text-lg font-bold tracking-tight sm:text-xl">
              {section.category}
            </h2>
          </ScrollReveal>

          <ScrollReveal direction="up" stagger className="flex flex-col gap-3">
            {section.items.map((item, idx) => {
              const key = `${section.category}-${idx}`;
              const isOpen = openIndex === key;
              const contentId = `faq-${key}-content`;
              const headerId = `faq-${key}-header`;

              return (
                <div
                  key={key}
                  className={cn(
                    "border-3 border-border bg-background transition-all duration-200",
                    "[transition-timing-function:cubic-bezier(0.165,0.84,0.44,1)]",
                    isOpen ? "shadow-hard" : "hover:shadow-hard"
                  )}
                >
                  <button
                    id={headerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => handleToggle(key)}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "transition-colors duration-150 hover:bg-muted"
                    )}
                  >
                    <span className="font-heading text-sm font-semibold tracking-tight sm:text-base">
                      {item.question}
                    </span>
                    <div
                      className={cn(
                        "shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                        isOpen && "rotate-180"
                      )}
                    >
                      <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    </div>
                  </button>

                  <div
                    id={contentId}
                    role="region"
                    aria-labelledby={headerId}
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t-2 border-border px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
                        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-7">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </ScrollReveal>
        </div>
      ))}
    </div>
  );
}
