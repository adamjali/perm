"use client";

/**
 * useGSAP Hook
 *
 * Lazy-loads GSAP + ScrollTrigger and provides
 * a clean API for scroll-triggered animations.
 * Performance-optimized: only loads on demand.
 */

import * as React from "react";

type GSAPInstance = typeof import("gsap").default;
type ScrollTriggerPlugin = typeof import("gsap/ScrollTrigger").ScrollTrigger;

let gsapInstance: GSAPInstance | null = null;
let scrollTriggerPlugin: ScrollTriggerPlugin | null = null;
let loadPromise: Promise<void> | null = null;

async function loadGSAP(): Promise<{
  gsap: GSAPInstance;
  ScrollTrigger: ScrollTriggerPlugin;
}> {
  if (gsapInstance && scrollTriggerPlugin) {
    return { gsap: gsapInstance, ScrollTrigger: scrollTriggerPlugin };
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const [gsapModule, stModule] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsapInstance = gsapModule.default;
      scrollTriggerPlugin = stModule.ScrollTrigger;
      gsapInstance.registerPlugin(scrollTriggerPlugin);
    })();
  }

  await loadPromise;
  return { gsap: gsapInstance!, ScrollTrigger: scrollTriggerPlugin! };
}

/**
 * Hook that lazy-loads GSAP and returns it when ready.
 * Returns null while loading, or if prefers-reduced-motion is set.
 */
export function useGSAP() {
  const [tools, setTools] = React.useState<{
    gsap: GSAPInstance;
    ScrollTrigger: ScrollTriggerPlugin;
  } | null>(null);

  React.useEffect(() => {
    // Respect reduced motion preference
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    loadGSAP().then(({ gsap, ScrollTrigger }) => {
      setTools({ gsap, ScrollTrigger });
    });
  }, []);

  return tools;
}

/**
 * Hook for scroll-triggered stagger animations on child elements.
 * Animates children in with a stagger delay as they enter viewport.
 */
export function useScrollStagger(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string,
  options?: {
    y?: number;
    stagger?: number;
    duration?: number;
    start?: string;
  }
) {
  const gsapTools = useGSAP();

  React.useEffect(() => {
    if (!gsapTools || !containerRef.current) return;

    const { gsap } = gsapTools;
    const el = containerRef.current;
    const children = el.querySelectorAll(selector);

    if (children.length === 0) return;

    gsap.set(children, { opacity: 0, y: options?.y ?? 30 });

    const ctx = gsap.context(() => {
      gsap.to(children, {
        opacity: 1,
        y: 0,
        stagger: options?.stagger ?? 0.1,
        duration: options?.duration ?? 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: options?.start ?? "top 85%",
          toggleActions: "play none none none",
        },
      });
    }, el);

    return () => {
      ctx.revert();
    };
  }, [gsapTools, containerRef, selector, options?.y, options?.stagger, options?.duration, options?.start]);
}

/**
 * Hook for parallax effect on a single element.
 */
export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  speed: number = 0.3
) {
  const gsapTools = useGSAP();

  React.useEffect(() => {
    if (!gsapTools || !ref.current) return;

    const { gsap } = gsapTools;
    const el = ref.current;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: speed * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }, el);

    return () => {
      ctx.revert();
    };
  }, [gsapTools, ref, speed]);
}
