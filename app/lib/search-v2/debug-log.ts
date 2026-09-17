/** Session debug ingest — keep until analysis is verified. */
export function dbg(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
): void {
  // #region agent log
  fetch("http://127.0.0.1:7612/ingest/dcbec1f8-f218-4dc2-b274-e76ed38526b3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ea0199",
    },
    body: JSON.stringify({
      sessionId: "ea0199",
      runId: "pre-fix",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  console.log("[search-v2-debug]", hypothesisId, location, message, JSON.stringify(data));
}
