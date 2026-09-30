import { NotificationsPageClient } from "./NotificationsPageClient";

/**
 * The page itself. It draws its real layout at once and holds only the list
 * as a skeleton while that loads, so there is nothing a separate loading
 * picture could add. The one this replaced used a padded container the page
 * does not have (the page jumped 32px up on arrival) and a shorter header.
 */
export default function NotificationsLoading() {
  return <NotificationsPageClient />;
}
