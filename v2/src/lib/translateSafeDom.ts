/**
 * Keeps React from crashing a page a browser has translated.
 *
 * Chrome's and Safari's built-in Translate replace a page's text nodes with
 * their own `<font>` wrappers, so a node React still holds is no longer where
 * React put it. The next update then calls `removeChild` or `insertBefore` on a
 * parent the node has left, the browser throws NotFoundError, and the page drops
 * to its error screen. Seen Sep 16 to Oct 15 2026 on 5 visits, every one read in
 * another language (Russian, Chinese, French); this site's readers often wait on
 * a case in a language other than English. React's maintainers describe the
 * clash and this guard in facebook/react#11538.
 *
 * The guard: removing a node that has already left the parent is a no-op, and
 * inserting before a node a translator wrapped goes before the wrapper. The
 * translated text can lag in that one spot; the page keeps working.
 *
 * Plain module. `guardDomAgainstTranslators` runs once from
 * src/instrumentation-client.ts, before the app hydrates.
 */

export type GuardSkip = "removeChild" | "insertBefore";

interface Patchable {
  removeChild<T extends Node>(child: T): T;
  insertBefore<T extends Node>(node: T, child: Node | null): T;
}

const GUARDED = Symbol.for("permtracker.translateSafeDom");

/** The child of `parent` that holds `node`, or null when `node` isn't inside it. */
function directChildHolding(parent: Node, node: Node): Node | null {
  let at: Node | null = node;
  while (at && at.parentNode !== parent) at = at.parentNode;
  return at;
}

/**
 * Patches `proto` (Node.prototype in the browser) and returns a function that
 * puts the originals back. Calling it twice patches once. `onSkip` hears each
 * operation the guard changed, so how often translation interferes can be counted.
 */
export function guardDomAgainstTranslators(proto: Patchable, onSkip?: (op: GuardSkip) => void): () => void {
  const marked = proto as Patchable & { [GUARDED]?: boolean };
  if (marked[GUARDED]) return () => {};

  const removeChild = proto.removeChild;
  const insertBefore = proto.insertBefore;

  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      onSkip?.("removeChild");
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      onSkip?.("insertBefore");
      const holder = directChildHolding(this, ref);
      // A wrapped reference: go before the wrapper. A reference that has left
      // altogether: there is no right place, so the node isn't inserted.
      return holder ? (insertBefore.call(this, node, holder) as T) : node;
    }
    return insertBefore.call(this, node, ref) as T;
  };

  marked[GUARDED] = true;
  return () => {
    proto.removeChild = removeChild;
    proto.insertBefore = insertBefore;
    delete marked[GUARDED];
  };
}
