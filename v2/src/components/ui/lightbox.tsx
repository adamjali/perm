"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface LightboxProps {
  /** Image source for image mode */
  src?: string;
  /** Alt text */
  alt?: string;
  /** Video source for MP4 mode */
  videoSrc?: string;
  /** Optional caption shown below media */
  caption?: string;
  /** Trigger element (the clickable thumbnail) */
  children: React.ReactNode;
  /** Additional className for the trigger wrapper */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Lightbox component for expanding images and videos into a fullscreen overlay.
 *
 * Built on Radix Dialog for accessibility (focus trap, Escape to close).
 * Blurred backdrop with high-quality media display.
 *
 * @example
 * ```tsx
 * // Image mode
 * <Lightbox src="/images/screenshot.png" alt="Dashboard">
 *   <Image src="/images/screenshot.png" width={400} height={300} alt="Dashboard" />
 * </Lightbox>
 *
 * // Video mode
 * <Lightbox videoSrc="/videos/demo.mp4" alt="Demo">
 *   <video src="/videos/demo.mp4" ... />
 * </Lightbox>
 * ```
 */
export function Lightbox({
  src,
  videoSrc,
  alt = "",
  caption,
  children,
  className,
}: LightboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <div
          className={cn("cursor-zoom-in", className)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {children}
        </div>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* Blurred overlay backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/70 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "duration-150"
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "duration-150 outline-none"
          )}
          onClick={(e) => {
            // Close when clicking the backdrop area (not the media itself)
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {alt || "Media preview"}
          </DialogPrimitive.Title>

          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
            {/* Close button */}
            <DialogPrimitive.Close
              className={cn(
                "absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center",
                "bg-black/60 text-white hover:bg-black/80",
                "border-2 border-white/20 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-white/50"
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            {/* Media content */}
            {videoSrc ? (
              <video
                src={videoSrc}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="max-w-[90vw] max-h-[85vh] border-2 border-white/20 shadow-hard-lg"
              >
                <track kind="captions" />
              </video>
            ) : src ? (
              <div className="relative border-2 border-white/20 shadow-hard-lg overflow-hidden">
                <Image
                  src={src}
                  alt={alt}
                  width={1920}
                  height={1080}
                  className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain"
                  sizes="90vw"
                  quality={95}
                />
              </div>
            ) : null}

            {/* Caption */}
            {caption && (
              <p className="mt-3 text-center text-sm text-white/70 font-mono max-w-lg">
                {caption}
              </p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
