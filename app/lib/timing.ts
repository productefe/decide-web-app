import { NextResponse } from "next/server";

/** Per-request stage timings for latency diagnosis (logs + response). */
export type TimingSnapshot = {
  total_ms: number;
  ms: Record<string, number>;
  [key: string]: unknown;
};

export class RequestTimer {
  private readonly t0 = Date.now();
  private readonly marks = new Map<string, number>();

  /** Measure an async block and store its duration under `name`. */
  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.marks.set(name, Date.now() - start);
    }
  }

  /** Record a duration that was measured elsewhere (ms). */
  set(name: string, ms: number): void {
    this.marks.set(name, Math.max(0, Math.round(ms)));
  }

  snapshot(extra: Record<string, unknown> = {}): TimingSnapshot {
    const ms: Record<string, number> = {};
    for (const [k, v] of this.marks) ms[k] = v;
    return {
      total_ms: Date.now() - this.t0,
      ms,
      ...extra,
    };
  }

  log(route: string, snap: TimingSnapshot): void {
    console.log(`[timing] ${route}`, JSON.stringify(snap));
  }

  /** Attach timing to JSON body + Server-Timing / X-Decide-Timing headers. */
  json<T extends Record<string, unknown>>(
    body: T,
    snap: TimingSnapshot,
    init?: { status?: number }
  ): NextResponse {
    this.log(
      typeof snap.route === "string" ? snap.route : "api",
      snap
    );
    const parts = Object.entries(snap.ms).map(
      ([name, dur]) => `${name.replace(/[^a-zA-Z0-9_-]/g, "_")};dur=${dur}`
    );
    parts.push(`total;dur=${snap.total_ms}`);
    return NextResponse.json(
      { ...body, _timing: snap },
      {
        status: init?.status,
        headers: {
          "Server-Timing": parts.join(", "),
          "X-Decide-Timing": JSON.stringify(snap),
        },
      }
    );
  }
}
