import type { EducationSite } from "../../types";

export const LUNAR_RADIUS_KM = 1737.4;
export const LUNAR_RADIUS_M = 1_737_400;
export const LUNAR_MU_M3_S2 = 4.9028e12;
export const LUNAR_GRAVITY_M_S2 = 1.622;

export interface GameLandingSite {
  id: string;
  name: string;
  mission: string;
  latitudeDeg: number;
  longitudeEastDeg: number;
  orbitAltitudeKm: number;
  landingGateKm: number;
  hint: string;
}

export const FALLBACK_GAME_SITES: GameLandingSite[] = [
  {
    id: "game-mons-mouton",
    name: "Mons Mouton · Meseta Artemis III",
    mission: "Artemis III / IM-2",
    latitudeDeg: -85.43,
    longitudeEastDeg: 31.74,
    orbitAltitudeKm: 108,
    landingGateKm: 8,
    hint: "Southern polar plateau.",
  },
  {
    id: "game-chandrayaan-3",
    name: "Shiv Shakti Point · Chandrayaan-3",
    mission: "Chandrayaan-3 (2023)",
    latitudeDeg: -69.37,
    longitudeEastDeg: 32.32,
    orbitAltitudeKm: 115,
    landingGateKm: 5,
    hint: "A landing at southern high latitude.",
  },
  {
    id: "game-change-4",
    name: "Von Kármán Crater · Chang'e 4",
    mission: "Chang'e 4 (2019)",
    latitudeDeg: -45.46,
    longitudeEastDeg: 177.59,
    orbitAltitudeKm: 120,
    landingGateKm: 4,
    hint: "The first lunar far-side landing.",
  },
  {
    id: "game-apollo-15",
    name: "Hadley-Apennine · Apolo 15",
    mission: "Apollo 15 (1971)",
    latitudeDeg: 26.13,
    longitudeEastDeg: 3.63,
    orbitAltitudeKm: 106,
    landingGateKm: 6,
    hint: "Near the Apennine Mountains and Hadley Rille.",
  },
  {
    id: "game-apollo-17",
    name: "Taurus-Littrow · Apolo 17",
    mission: "Apollo 17 (1972)",
    latitudeDeg: 20.19,
    longitudeEastDeg: 30.77,
    orbitAltitudeKm: 112,
    landingGateKm: 2,
    hint: "The final crewed landing of the Apollo program.",
  },
  {
    id: "game-shackleton",
    name: "Shackleton Crater Rim",
    mission: "NASA PGDA 69 · South Pole",
    latitudeDeg: -89.54,
    longitudeEastDeg: -155.73,
    orbitAltitudeKm: 105,
    landingGateKm: 5,
    hint: "A near-polar orbit reaches this southern rim.",
  },
];

const ALTITUDE_PRESETS: Array<{ orbitKm: number; gateKm: number }> = [
  { orbitKm: 108, gateKm: 8 },
  { orbitKm: 115, gateKm: 5 },
  { orbitKm: 120, gateKm: 4 },
  { orbitKm: 106, gateKm: 6 },
  { orbitKm: 112, gateKm: 2 },
  { orbitKm: 105, gateKm: 5 },
];

export function mapEducationSitesToGameSites(
  eduSites: EducationSite[],
  initialSite?: EducationSite | null,
): GameLandingSite[] {
  const base = [...FALLBACK_GAME_SITES];
  if (initialSite && Math.abs(initialSite.latitude_deg) >= 2.0) {
    const exists = base.some((s) => s.id === initialSite.id);
    if (!exists) {
      base.unshift({
        id: initialSite.id,
        name: initialSite.name,
        mission: initialSite.mission_or_source,
        latitudeDeg: Number(initialSite.latitude_deg.toFixed(2)),
        longitudeEastDeg: Number(initialSite.longitude_east_deg.toFixed(2)),
        orbitAltitudeKm: 110,
        landingGateKm: 5,
        hint: initialSite.region,
      });
    }
  }

  for (const s of eduSites) {
    if (base.length >= 8) break;
    if (Math.abs(s.latitude_deg) < 2.0) continue;
    if (base.some((b) => b.id === s.id)) continue;
    const preset = ALTITUDE_PRESETS[base.length % ALTITUDE_PRESETS.length];
    base.push({
      id: s.id,
      name: s.name,
      mission: s.mission_or_source,
      latitudeDeg: Number(s.latitude_deg.toFixed(2)),
      longitudeEastDeg: Number(s.longitude_east_deg.toFixed(2)),
      orbitAltitudeKm: preset.orbitKm,
      landingGateKm: preset.gateKm,
      hint: s.region,
    });
  }
  return base;
}

export interface PlaneChangeSolution {
  requiredInclinationDeg: number;
  ascendingNodeDeg: number;
  orbitalVelocityMs: number;
  planeChangeDeltaVMs: number;
}

/** Choose a circular orbit whose latitude extremum passes through the target.
 * The impulsive plane-change estimate assumes a common node with the initial orbit.
 */
export function solveInclinationForSite(
  latitudeDeg: number,
  longitudeEastDeg: number,
  orbitAltitudeKm: number,
  initialInclinationDeg = 0,
): PlaneChangeSolution {
  if (
    !Number.isFinite(latitudeDeg) ||
    Math.abs(latitudeDeg) > 90 ||
    !Number.isFinite(longitudeEastDeg) ||
    !Number.isFinite(orbitAltitudeKm) ||
    orbitAltitudeKm <= 0 ||
    !Number.isFinite(initialInclinationDeg)
  ) {
    throw new Error("Invalid orbit or target coordinates");
  }
  const absLat = Math.abs(latitudeDeg);

  const rawOmega =
    latitudeDeg >= 0 ? longitudeEastDeg - 90 : longitudeEastDeg + 90;
  const ascendingNodeDeg = ((((rawOmega + 180) % 360) + 360) % 360) - 180;

  const rMeters = LUNAR_RADIUS_M + orbitAltitudeKm * 1000;
  const orbitalVelocityMs = Math.sqrt(LUNAR_MU_M3_S2 / rMeters);
  const deltaIRad = (Math.abs(absLat - initialInclinationDeg) * Math.PI) / 180;
  const planeChangeDeltaVMs = 2 * orbitalVelocityMs * Math.sin(deltaIRad / 2);

  return {
    requiredInclinationDeg: Number(absLat.toFixed(2)),
    ascendingNodeDeg: Number(ascendingNodeDeg.toFixed(2)),
    orbitalVelocityMs: Math.round(orbitalVelocityMs),
    planeChangeDeltaVMs: Math.round(planeChangeDeltaVMs),
  };
}

/** Geographic projection of a circular orbit in a fixed lunar frame. */
export function orbitPointLatLon(
  inclinationDeg: number,
  ascendingNodeDeg: number,
  argumentOfLatRad: number,
): { latitudeDeg: number; longitudeEastDeg: number } {
  const incRad = (inclinationDeg * Math.PI) / 180;
  const omegaRad = (ascendingNodeDeg * Math.PI) / 180;
  const sinU = Math.sin(argumentOfLatRad);
  const cosU = Math.cos(argumentOfLatRad);

  const sinLat = Math.sin(incRad) * sinU;
  const latRad = Math.asin(Math.max(-1, Math.min(1, sinLat)));
  const deltaLon = Math.atan2(Math.cos(incRad) * sinU, cosU);
  const lonDeg =
    ((((((omegaRad + deltaLon) * 180) / Math.PI + 180) % 360) + 360) % 360) -
    180;

  return {
    latitudeDeg: (latRad * 180) / Math.PI,
    longitudeEastDeg: lonDeg,
  };
}

export interface Phase2Mechanics {
  orbitAltitudeKm: number;
  landingGateKm: number;
  descentDeltaKm: number;
  initialSpeedMs: number;
  periluneSpeedMs: number;
  deorbitBurnDeltaVMs: number;
  totalDescentDeltaVMs: number;
}

/** Educational two-impulse transfer and braking estimate; not a trajectory optimizer. */
export function computePhase2Mechanics(
  orbitAltitudeKm: number,
  landingGateKm: number,
): Phase2Mechanics {
  if (
    !Number.isFinite(orbitAltitudeKm) ||
    !Number.isFinite(landingGateKm) ||
    landingGateKm < 0 ||
    orbitAltitudeKm <= landingGateKm
  ) {
    throw new Error("Orbital altitude must exceed a nonnegative landing gate");
  }
  const r1 = LUNAR_RADIUS_M + orbitAltitudeKm * 1000;
  const r2 = LUNAR_RADIUS_M + landingGateKm * 1000;
  const aTransfer = (r1 + r2) / 2;

  const v1Circ = Math.sqrt(LUNAR_MU_M3_S2 / r1);
  const vTransferApo = Math.sqrt(LUNAR_MU_M3_S2 * (2 / r1 - 1 / aTransfer));
  const vTransferPeri = Math.sqrt(LUNAR_MU_M3_S2 * (2 / r2 - 1 / aTransfer));

  const deorbitBurnDeltaVMs = v1Circ - vTransferApo;

  const totalDescentDeltaVMs = deorbitBurnDeltaVMs + (vTransferPeri - 6);

  return {
    orbitAltitudeKm,
    landingGateKm,
    descentDeltaKm: Number((orbitAltitudeKm - landingGateKm).toFixed(2)),
    initialSpeedMs: Math.round(v1Circ),
    periluneSpeedMs: Math.round(vTransferPeri),
    deorbitBurnDeltaVMs: Number(deorbitBurnDeltaVMs.toFixed(1)),
    totalDescentDeltaVMs: Math.round(totalDescentDeltaVMs),
  };
}
