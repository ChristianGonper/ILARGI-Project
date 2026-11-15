import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requestData, savedResponse } from "../src/dataSource";
import type { SiteAnalysisResult } from "../src/types";

const readDemo = (file: string) =>
  readFileSync(new URL(`../public/demo/${file}`, import.meta.url), "utf8");
const point = {
  label: "P1",
  site_name: "Renamed",
  latitude_deg: -89.5,
  longitude_east_deg: 0,
  start_utc: "2026-04-02T15:00:00Z",
};
const payload = {
  points: [point],
  duration_hours: 720,
  step_minutes: 60,
  instrument_height_m: 2,
  azimuth_step_deg: 0.25,
  dem_mode: "auto",
};

test("saved responses preserve coordinates and reject missing dates, points and parameters", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(readDemo(String(url).replace("/demo/", "")));
  try {
    const result = await savedResponse<{ results: SiteAnalysisResult[] }>(
      "/api/analyze",
      { ...payload, points: [point, { ...point, longitude_east_deg: 360 }] },
    );
    assert.equal(result.results.length, 2);
    assert.equal(result.results[1].label, "P2");
    assert.equal(result.results[0].data_source, "precomputed");
    assert.notEqual(result.results[0].site_name, "Renamed");
    for (const change of [
      { step_minutes: 120 },
      { instrument_height_m: 10 },
      { points: [{ ...point, start_utc: "2026-04-03T15:00:00Z" }] },
      { points: [{ ...point, latitude_deg: -89.51 }] },
    ]) {
      await assert.rejects(
        savedResponse("/api/analyze", { ...payload, ...change }),
        /needs the live API/,
      );
    }
    await assert.rejects(savedResponse("/api/health"), /unavailable/);
  } finally {
    globalThis.fetch = original;
  }
});

test("live success and validation errors stay live; overload opens the saved-data circuit", async () => {
  const original = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const timeouts: number[] = [];
  AbortSignal.timeout = (ms) => {
    timeouts.push(ms);
    return new AbortController().signal;
  };
  let fail = false;
  let liveCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("/demo/"))
      return new Response(readDemo(String(url).replace("/demo/", "")));
    liveCalls++;
    if (String(url).endsWith("/analyze"))
      return Response.json({ detail: "Invalid request" }, { status: 422 });
    return fail
      ? new Response("busy", { status: 503 })
      : Response.json([{ id: "live-site" }]);
  };
  try {
    assert.deepEqual(await requestData("/api/sites"), [{ id: "live-site" }]);
    await assert.rejects(
      requestData("/api/analyze", payload),
      /Invalid request/,
    );
    assert.deepEqual(timeouts, [30000, 150000]);
    fail = true;
    const saved = await requestData<{ id: string }[]>("/api/sites");
    assert.equal(saved.length, 11);
    const count = liveCalls;
    await requestData("/api/sites");
    assert.equal(liveCalls, count);
  } finally {
    globalThis.fetch = original;
    AbortSignal.timeout = originalTimeout;
  }
});
