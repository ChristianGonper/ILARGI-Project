import type { EducationSite } from "../../types";

export const LUNAR_RADIUS_KM = 1737.4;
export const LUNAR_RADIUS_M = 1_737_400;
export const LUNAR_MU_M3_S2 = 4.9028e12; // GM de la Luna (m^3/s^2)
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

/**
 * Emplazamientos curados para el juego (todos con latitud != 0° para que
 * el cambio de inclinación desde la parking orbit ecuatorial sea visual y real).
 */
export const FALLBACK_GAME_SITES: GameLandingSite[] = [
  {
    id: "game-mons-mouton",
    name: "Mons Mouton · Meseta Artemis III",
    mission: "Artemis III / IM-2",
    latitudeDeg: -85.43,
    longitudeEastDeg: 31.74,
    orbitAltitudeKm: 108,
    landingGateKm: 8,
    hint: "Meseta polar sur con grandes ventanas de luz solar.",
  },
  {
    id: "game-chandrayaan-3",
    name: "Shiv Shakti Point · Chandrayaan-3",
    mission: "Chandrayaan-3 (2023)",
    latitudeDeg: -69.37,
    longitudeEastDeg: 32.32,
    orbitAltitudeKm: 115,
    landingGateKm: 5,
    hint: "El alunizaje más cercano al Polo Sur logrado hasta hoy.",
  },
  {
    id: "game-change-4",
    name: "Cráter Von Kármán · Chang'e 4",
    mission: "Chang'e 4 (2019)",
    latitudeDeg: -45.46,
    longitudeEastDeg: 177.59,
    orbitAltitudeKm: 120,
    landingGateKm: 4,
    hint: "Primer aterrizaje en la cara oculta de la Luna.",
  },
  {
    id: "game-apollo-15",
    name: "Hadley-Apennine · Apolo 15",
    mission: "Apollo 15 (1971)",
    latitudeDeg: 26.13,
    longitudeEastDeg: 3.63,
    orbitAltitudeKm: 106,
    landingGateKm: 6,
    hint: "Junto a los Montes Apeninos y la grieta de Hadley.",
  },
  {
    id: "game-apollo-17",
    name: "Taurus-Littrow · Apolo 17",
    mission: "Apollo 17 (1972)",
    latitudeDeg: 20.19,
    longitudeEastDeg: 30.77,
    orbitAltitudeKm: 112,
    landingGateKm: 2,
    hint: "Último alunizaje tripulado del programa Apolo.",
  },
  {
    id: "game-shackleton",
    name: "Borde Cráter Shackleton",
    mission: "NASA PGDA 69 · Polo Sur",
    latitudeDeg: -89.54,
    longitudeEastDeg: -155.73,
    orbitAltitudeKm: 105,
    landingGateKm: 5,
    hint: "Órbita casi polar (≈90°) para alcanzar el borde del Polo Sur.",
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
  // Si hay sitios adicionales desde la API con latitud suficiente, aseguramos al menos 6 opciones
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

/**
 * Calcula la inclinación mínima y el nodo ascendente para que el ground track
 * de una órbita circular corte exactamente con (latitudeDeg, longitudeEastDeg).
 */
export function solveInclinationForSite(
  latitudeDeg: number,
  longitudeEastDeg: number,
  orbitAltitudeKm: number,
  initialInclinationDeg = 0,
): PlaneChangeSolution {
  const absLat = Math.min(89.9, Math.max(0.5, Math.abs(latitudeDeg)));
  // Si lat >= 0, el ápice norte (u = +90°) está en lon = Omega + 90° -> Omega = lon - 90°
  // Si lat < 0, el ápice sur (u = -90°) está en lon = Omega - 90° -> Omega = lon + 90°
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

/**
 * Calcula la trayectoria del ground track (lat, lon) de una órbita circular
 * inclinada alrededor de la Luna para un ángulo de argumento de latitud u ∈ [0, 2π].
 */
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

/**
 * Calcula velocidades orbitales (m/s) y ΔV necesario (m/s) para bajar desde la
 * parking orbit hasta la altura de transición a Modo Aterrizar (Fase 3).
 */
export function computePhase2Mechanics(
  orbitAltitudeKm: number,
  landingGateKm: number,
): Phase2Mechanics {
  const r1 = LUNAR_RADIUS_M + orbitAltitudeKm * 1000;
  const r2 = LUNAR_RADIUS_M + landingGateKm * 1000;
  const aTransfer = (r1 + r2) / 2;

  const v1Circ = Math.sqrt(LUNAR_MU_M3_S2 / r1);
  const vTransferApo = Math.sqrt(LUNAR_MU_M3_S2 * (2 / r1 - 1 / aTransfer));
  const vTransferPeri = Math.sqrt(LUNAR_MU_M3_S2 * (2 / r2 - 1 / aTransfer));

  const deorbitBurnDeltaVMs = v1Circ - vTransferApo;
  // Frenado retropropulsivo final hasta velocidad vertical lenta de entrada a Fase 3 (~6 m/s)
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
