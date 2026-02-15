"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  /** Stagger children — each direct child fades in sequentially */
  stagger?: boolean;
}

export function FadeIn({
  children,
  className,
  direction = "up",
  delay = 0,
  stagger = false,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "50px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (stagger) {
    return (
      <div
        ref={ref}
        className={`fade-in-stagger ${visible ? "fade-in-stagger-visible" : ""} ${className ?? ""}`}
        style={delay ? { ["--stagger-base-delay" as string]: `${delay}s` } : undefined}
        data-direction={direction}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`fade-in ${visible ? "fade-in-visible" : ""} ${className ?? ""}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      data-direction={direction}
    >
      {children}
    </div>
  );
}
