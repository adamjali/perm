import { redirect } from "next/navigation";

/**
 * The installed app's opening page. src/proxy.ts answers /start first (the dashboard when signed in, the
 * homepage otherwise); this only runs if the proxy didn't, and sends everyone home.
 */
export default function Start(): never {
  redirect("/");
}
