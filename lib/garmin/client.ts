import "server-only";

const base = "https://personal.connectapi.garmin.com";
let cached: { key: string; token: string; until: number } | null = null;
let pending: { key: string; promise: Promise<string> } | null = null;

export class GarminError extends Error {
  constructor(public status: number) {
    super(status === 401 || status === 403
      ? "Garmin access was rejected. Check the Personal API key and its expiration."
      : status === 429 ? "Garmin is limiting requests. Please try again later."
        : "Garmin is unavailable or returned an unexpected response. Please try again later.");
  }
}

async function request(path: string, authorization: string, method = "GET") {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method, headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new GarminError(502); }
  if (!response.ok) throw new GarminError(response.status);
  try { return await response.json() as unknown; } catch { throw new GarminError(502); }
}

async function token(key: string): Promise<string> {
  if (cached?.key === key && cached.until > Date.now()) return cached.token;
  if (pending?.key === key) return pending.promise;
  const promise = (async () => {
    const result = await request("/personalapitoken-service/personal-api/personal-api-key/token", `ApiKey ${key}`, "POST");
    const payload = result as { access_token?: unknown; expires_in?: unknown } | null;
    if (!payload || typeof payload.access_token !== "string" || !payload.access_token) throw new GarminError(502);
    const seconds = typeof payload.expires_in === "number" && payload.expires_in > 0
      ? Math.min(payload.expires_in, 86_400) : 86_400;
    cached = { key, token: payload.access_token, until: Date.now() + Math.max(0, seconds - 60) * 1000 };
    return payload.access_token;
  })();
  const current = { key, promise };
  pending = current;
  try { return await promise; } finally { if (pending === current) pending = null; }
}

export async function fetchRuns(key: string, startDate: string, endDate: string) {
  const bearer = await token(key);
  const result: unknown[] = [];
  // Bounded pagination: never silently report an incomplete date window.
  for (let offset = 0; offset <= 500; offset += 100) {
    const query = new URLSearchParams({ start: String(offset), limit: "100", activityType: "running",
      startDate, endDate, sortOrder: "desc", excludeChildren: "true" });
    let page: unknown;
    try { page = await request(`/activitylist-service/activities/search/activities?${query}`, `Bearer ${bearer}`); }
    catch (error) { if (error instanceof GarminError && error.status === 401) cached = null; throw error; }
    if (!Array.isArray(page) || page.length > 100) throw new GarminError(502);
    if (result.length + page.length > 500) throw new Error("More than 500 runs found. Choose a shorter date range.");
    result.push(...page);
    if (page.length < 100) return result;
  }
  throw new Error("Choose a shorter date range.");
}
