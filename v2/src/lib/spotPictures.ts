/**
 * The site's still isometric pictures (scripts/spot-pictures/build.mjs writes this file and the SVGs
 * under public/images/spots/). Each picture is drawn once per page colour it sits on: `light` and
 * `dark` swap with the site's theme class; a picture with `dark` alone sits on a band that is dark
 * in both themes. SpotPicture (src/components/ui/spot-picture.tsx) renders them.
 */
export interface SpotPictureFiles {
  width: number;
  height: number;
  light?: string;
  dark: string;
}

export const SPOT_PICTURES = {
  "topic-start": { width: 160, height: 160, light: "/images/spots/topic-start-light.svg", dark: "/images/spots/topic-start-dark.svg" },
  "topic-case-status": { width: 160, height: 160, light: "/images/spots/topic-case-status-light.svg", dark: "/images/spots/topic-case-status-dark.svg" },
  "topic-queue": { width: 160, height: 160, light: "/images/spots/topic-queue-light.svg", dark: "/images/spots/topic-queue-dark.svg" },
  "topic-deadlines": { width: 160, height: 160, light: "/images/spots/topic-deadlines-light.svg", dark: "/images/spots/topic-deadlines-dark.svg" },
  "topic-wages": { width: 160, height: 160, light: "/images/spots/topic-wages-light.svg", dark: "/images/spots/topic-wages-dark.svg" },
  "topic-employers": { width: 160, height: 160, light: "/images/spots/topic-employers-light.svg", dark: "/images/spots/topic-employers-dark.svg" },
  "topic-green-card": { width: 160, height: 160, light: "/images/spots/topic-green-card-light.svg", dark: "/images/spots/topic-green-card-dark.svg" },
  "topic-seasonal": { width: 160, height: 160, light: "/images/spots/topic-seasonal-light.svg", dark: "/images/spots/topic-seasonal-dark.svg" },
  "topic-data-notes": { width: 160, height: 160, light: "/images/spots/topic-data-notes-light.svg", dark: "/images/spots/topic-data-notes-dark.svg" },
  "topic-explainers": { width: 160, height: 160, light: "/images/spots/topic-explainers-light.svg", dark: "/images/spots/topic-explainers-dark.svg" },
  "topic-practice": { width: 160, height: 160, light: "/images/spots/topic-practice-light.svg", dark: "/images/spots/topic-practice-dark.svg" },
  "home-waiting": { width: 200, height: 150, dark: "/images/spots/home-waiting-dark.svg" },
  "home-practice": { width: 200, height: 150, dark: "/images/spots/home-practice-dark.svg" },
  "security-vault": { width: 360, height: 300, dark: "/images/spots/security-vault-dark.svg" },
  "empty-cases": { width: 180, height: 160, light: "/images/spots/empty-cases-light.svg", dark: "/images/spots/empty-cases-dark.svg" },
  "empty-notifications": { width: 180, height: 160, light: "/images/spots/empty-notifications-light.svg", dark: "/images/spots/empty-notifications-dark.svg" },
  "not-found": { width: 180, height: 180, light: "/images/spots/not-found-light.svg", dark: "/images/spots/not-found-dark.svg" },
  "developers-keys": { width: 180, height: 180, light: "/images/spots/developers-keys-light.svg", dark: "/images/spots/developers-keys-dark.svg" },
} as const satisfies Record<string, SpotPictureFiles>;

export type SpotPictureName = keyof typeof SPOT_PICTURES;
