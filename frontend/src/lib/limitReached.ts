// Must match usage.LIMIT_REACHED_MARKER in backend/app/usage.py exactly.
// The backend prefixes a message with this when it should trigger the
// "request a limit increase" modal, rather than being displayed as an
// ordinary LLM error — a stable, unambiguous signal instead of matching on
// the human-readable text that follows, which could drift out of sync.
const MARKER = "[[daily_limit_reached]]";

export function isLimitReachedMessage(text: string | null | undefined): text is string {
  return !!text && text.startsWith(MARKER);
}

export function stripLimitReachedMarker(text: string): string {
  return text.startsWith(MARKER) ? text.slice(MARKER.length) : text;
}
