import type { SiteAnalysisResult } from "./types";

type Entry = {
  id: string;
  latitude_deg: number;
  longitude_east_deg: number;
  file: string;
};
export interface DemoManifest {
  schema_version: number;
  start_utc: string;
  analysis: Record<string, number | string>;
  education: Record<string, number>;
  analyses: Entry[];
  cycles: Entry[];
}

const env = import.meta.env ?? {};
const apiBase = (env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
let forcedStatic = env.VITE_DATA_MODE === "static";
let unavailableUntil = 0;
let usedDemo = forcedStatic;
let snapshot = forcedStatic ? "static" : "connecting";
const listeners = new Set<() => void>();
export const subscribeDataSource = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
export const getDataSource = () => snapshot;
function publish() {
  snapshot = usedDemo ? "static" : "live";
  listeners.forEach((callback) => callback());
}
export function useSavedData() {
  forcedStatic = true;
  usedDemo = true;
  publish();
}
export function retryLiveData() {
  // Reload clears every old chart and cycle, so its provenance cannot be relabelled.
  window.location.reload();
}

async function readStatic<T>(file: string): Promise<T> {
  const response = await fetch(`/demo/${file}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      "Saved demonstration data could not be loaded. Please reload the page.",
    );
  return response.json() as Promise<T>;
}
export const fetchDemoManifest = () =>
  readStatic<DemoManifest>("manifest.json");

function matchingEntry(entries: Entry[], lat: number, lon: number) {
  const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  return entries.find(
    (entry) =>
      Math.abs(entry.latitude_deg - lat) < 1e-7 &&
      Math.abs(wrap(entry.longitude_east_deg - lon)) < 1e-7,
  );
}

export async function savedResponse<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const resources: Record<string, string> = {
    "/api/sites": "sites.json",
    "/api/education/sites": "education-sites.json",
    "/api/materials-overlay": "materials-overlay.json",
  };
  if (resources[path]) return readStatic<T>(resources[path]);
  if (path === "/api/health")
    throw new Error("Live API is unavailable; saved data remains available.");
  const manifest = await fetchDemoManifest();
  if (manifest.schema_version !== 1)
    throw new Error("Unsupported saved data version. Please reload.");
  const unsupported = () =>
    new Error(
      "This request needs the live API. Saved data covers catalog sites from 2 April 2026, 15:00 UTC: analysis 720 h / 60 min / height 2 m, education 709 h / 180 min. Use Load demo settings to compare saved locations.",
    );
  const matches = (params: Record<string, number | string>) =>
    body && Object.entries(params).every(([key, value]) => body[key] === value);
  const sameStart = (value: unknown) =>
    typeof value === "string" &&
    Date.parse(value) === Date.parse(manifest.start_utc);
  if (
    path === "/api/analyze" &&
    matches(manifest.analysis) &&
    Array.isArray(body?.points)
  ) {
    const results = await Promise.all(
      body.points.map(async (point: Record<string, unknown>, index: number) => {
        const entry = matchingEntry(
          manifest.analyses,
          Number(point.latitude_deg),
          Number(point.longitude_east_deg),
        );
        if (!entry || !sameStart(point.start_utc)) throw unsupported();
        const result = await readStatic<SiteAnalysisResult>(entry.file);
        return {
          ...result,
          label: `P${index + 1}`,
          data_source: "precomputed",
        };
      }),
    );
    return { results } as T;
  }
  if (
    path === "/api/education/cycle" &&
    matches(manifest.education) &&
    sameStart(body?.start_utc)
  ) {
    const entry = matchingEntry(
      manifest.cycles,
      Number(body?.latitude_deg),
      Number(body?.longitude_east_deg),
    );
    if (entry) return readStatic<T>(entry.file);
  }
  throw unsupported();
}

export async function requestData<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!forcedStatic && Date.now() >= unavailableUntil) {
    try {
      const response = await fetch(`${apiBase}${path}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(body ? 25000 : 8000),
      });
      if (
        !response.ok &&
        response.status < 500 &&
        response.status !== 429 &&
        response.status !== 404
      ) {
        const error = (await response.json().catch(() => ({}))) as {
          detail?: unknown;
        };
        throw new RequestError(
          typeof error.detail === "string"
            ? error.detail
            : `Request rejected (${response.status}).`,
        );
      }
      if (!response.ok) throw new Error(`API unavailable (${response.status})`);
      const result = (await response.json()) as T;
      publish();
      return result;
    } catch (error) {
      if (error instanceof RequestError) throw error;
      unavailableUntil = Date.now() + 30000;
    }
  }
  usedDemo = true;
  publish();
  return savedResponse<T>(path, body);
}

class RequestError extends Error {}
