"use client";

/**
 * ShareButtons
 *
 * Share an article: X, LinkedIn, or copy the link. A copied link shows a
 * tick for two seconds.
 */

import * as React from "react";
import { CheckIcon, LinkedinLogoIcon, LinkIcon, XLogoIcon } from "@phosphor-icons/react";
import { SITE_URL } from "@/lib/constants/site";
interface ShareButtonsProps {
  title: string;
  url: string;
}

export default function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = React.useState(false);

  // The canonical origin on both server and client. Reading
  // `window.location.origin` here made the server render one href and the
  // client another, which React reports as a hydration mismatch it will not
  // patch, so the client's value was silently discarded anyway. A share link
  // should carry the canonical host regardless of where the page was opened.
  const fullUrl = `${SITE_URL}${url}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (HTTP context, denied permission) — expected
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`;

  const buttonClass =
    "flex size-11 items-center justify-center border border-input bg-card transition-colors hover:bg-accent";

  return (
    <div className="flex items-center gap-3">
      <span className="font-heading text-sm font-bold text-muted-foreground">
        Share
      </span>{" "}

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Share on X (Twitter)"
      >
        <XLogoIcon className="size-4" aria-hidden="true" />
      </a>{" "}

      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Share on LinkedIn"
      >
        <LinkedinLogoIcon className="size-4" aria-hidden="true" />
      </a>{" "}

      <button
        type="button"
        onClick={handleCopy}
        className={buttonClass}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? (
          <CheckIcon className="size-4 text-primary-text" aria-hidden="true" />
        ) : (
          <LinkIcon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
