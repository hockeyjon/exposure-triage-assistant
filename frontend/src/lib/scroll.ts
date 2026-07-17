// scrollIntoView's "am I already visible" heuristic gets confused when the
// target (or an intervening element) is many times taller than the
// viewport, as the findings list can be here — it sometimes scrolls the
// wrong way or not at all. Computing the true document offset and scrolling
// straight to it sidesteps that entirely.
export function scrollToId(id: string, edge: "top" | "bottom" = "top") {
  const el = document.getElementById(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const target = edge === "bottom" ? rect.bottom : rect.top;
  window.scrollTo({ top: target + window.scrollY, behavior: "auto" });
}
