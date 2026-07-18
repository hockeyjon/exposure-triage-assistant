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
export function scrollToId(id: string, edge: "top" | "bottom" = "top", behavior: ScrollBehavior = "auto") {
  const el = document.getElementById(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const target = edge === "bottom" ? rect.bottom : rect.top;
  const headerHeight = document.getElementById("site-header")?.getBoundingClientRect().height ?? 0;
  window.scrollTo({ top: target + window.scrollY - headerHeight, behavior });
}
