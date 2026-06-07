import { apiUrl, authHeaders } from "./fileClient";

export async function runBridgeAction({ action, resume, selectedField, handlers }) {
  const response = await fetch(apiUrl("/api/actions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ action, resume, selectedField })
  });

  if (!response.ok || !response.body) {
    throw new Error("Bridge request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      handlers?.[event.type]?.(event.payload);
    }
  }
}
