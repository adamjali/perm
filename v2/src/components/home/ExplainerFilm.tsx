import { JsonLdScript } from "@/components/seo/JsonLdScript";
import type { Film } from "@/lib/constants/films";
import { FilmPlayer } from "./FilmPlayer";
import { SITE_URL } from "@/lib/constants/site";

/** schema.org VideoObject, so search engines can list the film with its thumbnail. */
function videoSchema(film: Film) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: film.title,
    description: film.description,
    thumbnailUrl: `${SITE_URL}${film.poster}`,
    contentUrl: `${SITE_URL}${film.src}`,
    uploadDate: film.published,
    duration: `PT${Math.floor(film.duration / 60)}M${film.duration % 60}S`,
    transcript: film.transcript.join(" "),
  };
}

/**
 * One explainer film: its thumbnail as a play button, then the browser's own
 * player (FilmPlayer). The page pays for the thumbnail only (about 75 KB);
 * the 4 MB film loads when someone presses play. Native controls give
 * keyboard, picture-in-picture and full screen, and a phone gets the player
 * it already knows.
 *
 * The poster is a designed thumbnail: a settled frame from the film (the
 * calculator's answer, the deadline list), the film's title and its running
 * time. So the caption doesn't repeat them; it holds the transcript.
 *
 * The transcript sits under it, closed, so the words are on the page without
 * taking the page over.
 */
export function ExplainerFilm({ film, className = "" }: { film: Film; className?: string }) {
  return (
    <figure className={`m-0 ${className}`}>
      <JsonLdScript schema={videoSchema(film)} />
      <div className="border-3 border-border bg-black shadow-hard">
        <FilmPlayer src={film.src} poster={film.poster} title={film.title} duration={film.duration} />
      </div>{" "}
      <figcaption className="mt-2 text-sm text-foreground/75">
        <details>
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-bold text-foreground underline decoration-2 underline-offset-4">
            Read the transcript
          </summary>{" "}
          <div className="mt-2 space-y-2 border-l-3 border-border pl-4 text-base leading-relaxed text-foreground/85">
            {film.transcript.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>
      </figcaption>
    </figure>
  );
}
