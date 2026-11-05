"use client";

/**
 * "Share this month": the month's dated picture (/perm-queue/<month>/share.png)
 * with the four ways it travels. Copy the picture into a chat, save it, copy
 * the page's link, or copy an embed that links back. One status line says what
 * happened, including when a browser can't copy a picture.
 */

import { useState } from "react";
import { CheckIcon, CodeIcon, CopyIcon, DownloadSimpleIcon, LinkIcon } from "@phosphor-icons/react";

import { buttonVariants } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { SITE_URL } from "@/lib/constants/site";

type Action = "image" | "save" | "link" | "embed";

/** The embed a site pastes: the picture, linked to the month's page, alt text included. */
export function embedCode(month: string, alt: string): string {
  const attr = alt.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<a href="${SITE_URL}/perm-queue/${month}"><img src="${SITE_URL}/perm-queue/${month}/share.png" width="600" height="315" alt="${attr}"></a>`;
}

export function MonthShareBlock({ month, label, alt }: { month: string; label: string; alt: string }) {
  const src = `/perm-queue/${month}/share.png`;
  const [said, setSaid] = useState<{ action: Action; ok: boolean; text: string } | null>(null);
  // Shown when the browser won't copy it, so the code can be selected by hand.
  const [showEmbed, setShowEmbed] = useState(false);

  const done = (action: Action, ok: boolean, text: string) => {
    setSaid({ action, ok, text });
    if (ok) analytics.capture("month_share", { action, month });
  };

  const copyText = async (action: "link" | "embed", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      done(action, true, action === "link" ? `Link to ${label} copied.` : "Embed code copied.");
    } catch {
      if (action === "embed") {
        setShowEmbed(true);
        done(action, false, "This browser didn't allow copying. The embed code is below to select.");
      } else {
        done(action, false, "This browser didn't allow copying. Copy the address from the address bar instead.");
      }
    }
  };

  const copyImage = async () => {
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no picture clipboard");
      // The fetch goes inside the item so Safari still counts it as part of the click.
      const blob = fetch(src).then((r) => {
        if (!r.ok) throw new Error(`picture answered ${r.status}`);
        return r.blob();
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      done("image", true, "Picture copied. Paste it into a chat or a post.");
    } catch {
      done("image", false, "This browser can't copy pictures. Save it instead.");
    }
  };

  const button = buttonVariants({ variant: "outline", size: "default", className: "w-full justify-start" });
  const icon = (action: Action, Idle: typeof CopyIcon) =>
    said?.action === action && said.ok ? (
      <CheckIcon size={18} weight="bold" aria-hidden="true" />
    ) : (
      <Idle size={18} weight="bold" aria-hidden="true" />
    );

  return (
    <section aria-labelledby="share-month" className="mt-10">
      <h2 id="share-month" className="font-heading text-xl font-bold">
        Share {label}
      </h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-soft">
        Where the month stands as one picture, dated to the day it was counted.
      </p>{" "}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_13rem] [&>*]:min-w-0">
        {/* A plain img: the picture is drawn by our own route and already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={1200} height={630} alt={alt} className="object block h-auto w-full max-w-[600px]" loading="lazy" />{" "}
        <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2 md:grid-cols-1 [&>*]:min-w-0">
          <button type="button" onClick={copyImage} className={button}>
            {icon("image", CopyIcon)}
            Copy picture
          </button>{" "}
          <a
            href={src}
            download={`perm-${month}.png`}
            onClick={() => done("save", true, `Saving the ${label} picture.`)}
            className={button}
          >
            {icon("save", DownloadSimpleIcon)}
            Save picture
          </a>{" "}
          <button type="button" onClick={() => copyText("link", `${SITE_URL}/perm-queue/${month}`)} className={button}>
            {icon("link", LinkIcon)}
            Copy link
          </button>{" "}
          <button type="button" onClick={() => copyText("embed", embedCode(month, alt))} className={button}>
            {icon("embed", CodeIcon)}
            Copy embed code
          </button>
        </div>
      </div>{" "}
      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-soft">
        {said?.text ?? ""}
      </p>{" "}
      {showEmbed ? (
        <label className="mt-2 block text-sm font-bold">
          Embed code{" "}
          <textarea
            readOnly
            value={embedCode(month, alt)}
            onFocus={(e) => e.currentTarget.select()}
            rows={3}
            className="mt-2 block w-full min-w-0 border border-input bg-card p-3 font-mono text-sm font-normal"
          />
        </label>
      ) : null}
    </section>
  );
}
