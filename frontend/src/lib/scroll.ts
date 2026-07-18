// scrollIntoView's "am I already visible" heuristic gets confused when the
// target (or an intervening element) is many times taller than the
// viewport, as the findings list can be here — it sometimes scrolls the
// wrong way or not at all. Computing the true document offset and scrolling
// straight to it sidesteps that entirely.
//
// The header is sticky, so "the top of the viewport" isn't actually clear
// space — it's covered by the header. Every target aligns against the
// header's bottom edge instead, so scrolled-to content is never hidden
// underneath it.
export function scrollToElement(
  el: HTMLElement,
  edge: "top" | "bottom" = "top",
  behavior: ScrollBehavior = "auto",
  offset = 0,
) {
  const rect = el.getBoundingClientRect();
  const target = edge === "bottom" ? rect.bottom : rect.top;
  const headerHeight = document.getElementById("site-header")?.getBoundingClientRect().height ?? 0;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const top = Math.min(target + window.scrollY - headerHeight - offset, maxScroll);
  window.scrollTo({ top, behavior });
}

export function scrollToId(id: string, edge: "top" | "bottom" = "top", behavior: ScrollBehavior = "auto", offset = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  scrollToElement(el, edge, behavior, offset);
}

// Pinning an element's bottom edge just above the bottom of the viewport is
// a different goal from scrollToElement above: the sticky header only
// obscures the top of the viewport, so there's no header-relative anchor
// point here — just however far the element's bottom currently overshoots
// where we want it to sit. Scrolling by exactly that amount, repeatedly as
// the element grows, is what keeps it pinned instead of jumping around.
export function stickBottomToViewport(el: HTMLElement, offset = 0, behavior: ScrollBehavior = "auto") {
  const rect = el.getBoundingClientRect();
  const overflow = rect.bottom - (window.innerHeight - offset);
  if (overflow <= 0) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const top = Math.min(window.scrollY + overflow, maxScroll);
  window.scrollTo({ top, behavior });
}
