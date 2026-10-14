import type { Transition } from "motion/react";

/**
 * The one spring the app still uses: the chat panel and its cards opening
 * when asked. Fast to settle (about 0.3s) and with little overshoot. Nothing
 * else on the site moves unless the reader did something.
 */
export const springConfig: Transition = { type: "spring", stiffness: 500, damping: 30 };
