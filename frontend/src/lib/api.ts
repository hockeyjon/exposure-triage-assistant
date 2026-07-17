import type { Dependency, NodeEvent } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type StreamEvent =
  | { type: "node"; payload: NodeEvent }
  | { type: "done"; payload: { state: NodeEvent["state"] } }
  | { type: "error"; payload: { message: string } };

export async function fetchInventory(): Promise<Dependency[]> {
  const resp = await fetch(`${API_URL}/inventory`);
  if (!resp.ok) throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  return data.dependencies;
}

/**
 * Consumes the backend's Server-Sent Events stream from GET /analyze — no
 * request body, since there's no user input. It analyzes whatever is
 * currently loaded in the inventory database. Parses raw
 * "event: X\ndata: Y\n\n" frames manually since EventSource is GET-only in
 * spirit but doesn't give us the same error-handling control as fetch.
 */
export async function* streamAnalysis(): AsyncGenerator<StreamEvent> {
  const resp = await fetch(`${API_URL}/analyze`);

  if (!resp.ok || !resp.body) {
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!eventLine || !dataLine) continue;

      const type = eventLine.slice("event: ".length).trim();
      const payload = JSON.parse(dataLine.slice("data: ".length));

      if (type === "node") yield { type: "node", payload };
      else if (type === "done") yield { type: "done", payload };
      else if (type === "error") yield { type: "error", payload };
    }
  }
}
