# Design System: ILARGI (Scientific Mode — Draft v0.1)

> **Working Draft Notice:** This `DESIGN.md` is an initial working specification for the **Scientific / Technical Mode** of **ILARGI** (_Interactive Lunar Analyzer for Radiance, Geometry, and Intervisibility_), oriented toward a dedicated web frontend backed by a **FastAPI** scientific API. Charting and 3D rendering libraries are intentionally kept technology-agnostic at this stage. All aesthetic, layout, and component decisions here are provisional and designed to be iterated.

---

## 1. Visual Theme & Atmosphere

**Telemetry Dark — Precision Mission-Control Instrumentation.**
ILARGI's scientific workspace takes inspiration from JPL mission operations consoles, orbital geometry analyzers, and lunar cartography tools. The atmosphere is dark, focused, and analytical: deep abyssal space navy surfaces (`#0B101B`) host crisp slate instrument panels (`#131B2E`) separated by `1px` structural hairlines (`#26334D`) with zero heavy drop shadows.

- **Lightness & Temperature:** Dark-mode primary (`#0B101B` canvas) with cool aerospace slate neutrals (`#131B2E`, `#1C2740`) so luminous celestial markers (Sun amber, Earth cyan, Moon silver) and angular telemetry curves stand out cleanly without visual glare.
- **Density:** Compact technical workbench. High information density organized via strict alignment, `1px` containment borders, and tabular monospace numbers rather than decorative whitespace or marketing-style oversized cards.
- **UI Language:** English (`EN`), tailored for international review (NASA Space Apps) while preserving unambiguous SPICE/NAIF conventions (`UTC`, `J2000`, `MOON_ME`, `DE440s`).

---

## 2. Color Palette & Roles

### Primary Foundation

- **Abyssal Space (`#0B101B`):** Root application background, 3D orbital/topographic canvas background, and inset input fields.
- **Instrument Slate (`#131B2E`):** Primary container surface for the fixed left scenario sidebar, KPI metric cards, data tables, and secondary controls.
- **Elevated Panel (`#1C2740`):** Hover states, active segmented controls, table header strips, and floating scale-inset header bars.
- **Structural Hairline (`#26334D`):** `1px` structural borders, panel dividers, table cell rules, and subtle 3D/2D plot gridlines.

### Accent & Interactive

- **Telemetry Cyan (`#38BDF8`):** Primary interactive accent, active navigation/toggle states, focus rings, and Earth orbital marker/curve.
- **Deep Orbital Blue (`#0284C7`):** Hover/pressed state for primary action buttons and active selection fills.

### Typography & Text Hierarchy

- **Starlight White (`#F1F5F9`):** Primary headings, KPI numeric readouts, and primary table cell values.
- **Telemetry Silver (`#CBD5E1`):** Secondary body text, control labels, table headers, and Moon marker/orbit.
- **Muted Horizon (`#94A3B8`):** Captions, axis tick labels, unit annotations (`km`, `deg`, `UTC`), and provenance metadata.

### Functional & Scientific Domain States

- **Solar Amber (`#F59E0B`, tint `rgba(245, 158, 11, 0.12)`):** Sun marker, solar trajectories, solar elevation curves, and `sun_ok` indicators.
- **Earth Cyan (`#38BDF8`, tint `rgba(56, 189, 248, 0.12)`):** Earth marker, Earth trajectories, Earth visibility curves, and `earth_ok` indicators.
- **Lunar Regolith (`#CBD5E1`, terrain fill `#1E293B` / stroke `#64748B`):** Moon center marker, lunar reference axes, and topographic LOLA horizon silhouettes $H(\text{azimuth})$.
- **Nominal / Joint Window Emerald (`#10B981`, tint `rgba(16, 185, 129, 0.12)`):** Verified ephemeris kernel status (`DE440s · OK`), joint visibility windows (`both_ok`), and valid computation states.
- **Geometric Disclaimer / Outage Rose (`#F43F5E` border, `#FB7185` text, tint `rgba(244, 63, 94, 0.12)`):** Non-physical scope warnings (`GEOMETRIC CENTERS ONLY`), occultation/outage spans, out-of-coverage alerts, and hard constraint violations.

---

## 3. Typography Rules

- **Primary UI Typeface — `Inter`:** Used for workspace headers, sidebar labels, buttons, navigation tabs, and analytical notes.
  - **App / Workbench Title:** `18px` / `24px` line-height, weight `700`, tracking `-0.015em`.
  - **Panel Heading (`H2`):** `14px` / `20px` line-height, weight `600`, tracking `-0.005em`.
  - **Section Eyebrow / Label:** `11px` / `16px` line-height, weight `700`, uppercase, tracking `+0.08em`, color `#94A3B8`.
  - **Body & Control Labels:** `13px` / `18px` line-height, weight `400`–`500`.
- **Telemetry & Data Typeface — `JetBrains Mono`:** Mandatory `font-variant-numeric: tabular-nums` for all numeric values so columns and live updates never jitter.
  - **KPI Readouts:** `20px`–`22px` / `26px` line-height, weight `600`, `#F1F5F9` (e.g., `384,402 km`).
  - **Table & Coordinate Cells:** `12px` / `18px` line-height, weight `500`, right-aligned numeric columns (`X`, `Y`, `Z`, `Distance`).
  - **Provenance Chips & Timestamps:** `11px` / `14px` line-height, weight `500` (e.g., `2026-11-14T10:30:00Z`, `J2000`, `DE440s`).

---

## 4. Component Stylings

- **Buttons & Actions:**
  - `6px` (`rounded-md`) corner radius, `32px`–`36px` compact height, `12px` horizontal padding.
  - **Primary:** Solid `#38BDF8` fill with `#0B101B` `600`-weight text (hover `#0284C7` with `#F1F5F9` text).
  - **Secondary / Export:** `#131B2E` fill, `1px solid #26334D`, `#F1F5F9` text (e.g., `Export CSV`, `Export JSON`).
- **Instrument Cards & Panels:**
  - Flat `#131B2E` background, `1px solid #26334D`, `8px` (`rounded-lg`) radius, `14px`–`16px` internal padding, no drop shadows.
- **Fixed Scenario Sidebar (`280px`–`300px`):**
  - Anchored left column on `#131B2E` separated by a `1px solid #26334D` right border. Contains UTC date/time inputs, reference origin/frame segmented controls (`Sun–Earth` / `Earth–Moon`, `J2000` / `MOON_ME`), kernel verification pills, and a persistent scientific scope disclaimer block.
- **Inputs & Segmented Controls:**
  - `#0B101B` field fill, `1px solid #26334D` border (`#38BDF8` on focus), `6px` radius, `34px` height, monospace input values for dates, times, and coordinates.
- **Domain Component 1 — Primary 3D Viewport + Scale Inset (`Layout 1B`):**
  - Full-width primary 3D orbital/geometric viewport on `#0B101B` with subtle `#26334D` coordinate gridlines, interactive camera controls, and a top-left compact HUD showing active origin (`Sun` or `Earth`), frame (`J2000`), and scale note (`Distances to scale · Markers enlarged`).
  - Anchored bottom-right **Scale Inset** (`240px × 150px` on desktop, `#131B2E` frame with `1px solid #38BDF8` accent border) showing the secondary scale (`Earth–Moon` detail when `Sun–Earth` is primary, or vice versa) with a single-click swap trigger (`Swap Primary View`).
- **Domain Component 2 — Provenance & Scope Badges:**
  - `4px` (`rounded-sm`) monospace badges (`11px`) with `1px` tinted border and `12%` semantic fill: `DE440s · OK` (Emerald), `J2000` / `NONE CORRECTION` (Slate/Cyan), `GEOMETRIC CENTERS ONLY` (Rose).
- **Domain Component 3 — Scientific Coordinates Table:**
  - Dense sticky-header table (`34px` header, `32px` rows), `1px solid #26334D` horizontal rules, body color dot indicators (`#F59E0B` Sun, `#38BDF8` Earth, `#CBD5E1` Moon), right-aligned `tabular-nums` coordinates in `km`, and inline `Download CSV` / `Copy JSON` actions.

---

## 5. Layout Principles

- **Desktop Workbench Grid (`1280px`–`1600px` target):**
  - `4px` / `8px` spacing scale (`12px`–`16px` gutters between panels).
  - Persistent two-zone shell: **Left Scenario Sidebar (`280px` fixed)** + **Main Analytical Workspace (`1fr` fluid)**.
- **Screen 01 Priority — Ephemeris & 3D Geometry (Initial Evolution of `main.py`):**
  1. **Top Workbench Header (`48px`):** Brand mark `ILARGI`, mode indicator (`SCIENTIFIC WORKBENCH`), view switcher tabs (`01 Ephemeris 3D` active; `02 Horizon` / `03 Windows` / `04 Compare` as planned roadmap tabs), and provenance status pill (`DE440s · OK`).
  2. **KPI Metric Strip (3 equal columns):** `Sun – Earth Distance`, `Earth – Moon Distance`, `Sun – Moon Distance` in `km` with sub-label indicating `Geometric center-to-center`.
  3. **Hero Viewport Zone (`~460px`–`540px` height):** Primary interactive 3D canvas + bottom-right secondary scale inset and quick scale switcher.
  4. **Data & Provenance Zone:** Dense `Coordinates Relative to Origin` table (`Body`, `X (km)`, `Y (km)`, `Z (km)`, `Origin Distance (km)`) paired with a compact export bar (`CSV` / `JSON`) and explicit scientific caveats footer (instantaneous UTC, `NONE` light-time/aberration correction, leap-second notice, no terrain/illumination yet).
- **Extensibility for Future Scientific Screens (02–04):**
  - Keep the exact same sidebar + header shell and semantic color tokens when adding Screen 02 (Horizon Profile $H(\text{azimuth})$ & Disk Fraction), Screen 03 (Operational Windows `sun_ok`/`earth_ok`/`both_ok` & Events Table), and Screen 04 (Site Comparison Heatmap, Pareto & Delay Analysis).
- **Responsive Behavior:**
  - Below `1024px`: Sidebar collapses into a toggleable drawer or stacked top parameter bar; KPI strip wraps cleanly; the Scale Inset docks directly below the primary 3D viewport instead of overlapping it.

---

## 6. Design System Notes for Stitch Generation

- **Atmosphere & Style Keywords:** `Telemetry Dark`, `aerospace mission control`, `abyssal navy #0B101B`, `instrument slate #131B2E`, `crisp 1px #26334D borders`, `zero heavy drop shadows`, `compact technical workbench`, `Inter + JetBrains Mono tabular numbers`.
- **Canonical Colors to Reference:** Abyssal Space (`#0B101B`), Instrument Slate (`#131B2E`), Hairline Border (`#26334D`), Solar Amber (`#F59E0B`), Earth Cyan (`#38BDF8`), Moon Silver (`#CBD5E1`), Nominal Emerald (`#10B981`), Disclaimer Rose (`#F43F5E`).
- **Guardrails (Do's & Don'ts):**
  - **Do** keep numeric coordinates, distances, and timestamps in `JetBrains Mono` with tabular alignment.
  - **Do** include visible scientific provenance (`DE440s`, `J2000`, `NONE`) and a clear non-alarmist disclaimer when displaying geometric centers only.
  - **Don't** use generic SaaS gradients, rounded-pill glassmorphism, soft drop shadows, or rainbow chart palettes that break the Sun (`#F59E0B`) / Earth (`#38BDF8`) / Moon (`#CBD5E1`) semantic mapping.
  - **Don't** hard-code assumptions about a specific charting or 3D engine (design clean viewport containers suitable for any web visualization stack).
- **Starter Stitch Screen Prompt (Screen 01 — Ephemeris & 3D Geometry):**
  > "Desktop scientific web application screen for ILARGI Ephemeris & 3D Geometry Workbench in English, Telemetry Dark aesthetic. Deep abyssal navy background (#0B101B), flat instrument slate panels (#131B2E) with crisp 1px borders (#26334D), no heavy shadows, Inter UI typography and JetBrains Mono tabular numbers. Top 48px bar with ILARGI title, Scientific Workbench badge, navigation tabs (Ephemeris 3D active; Horizon, Windows, Compare muted), and green DE440s OK status pill. Fixed 280px left sidebar with UTC Date input, UTC Time input, Reference Frame selector (J2000 active), Primary Scale toggle (Sun-Earth / Earth-Moon), kernel manifest summary, and a rose-tinted disclaimer box stating Geometric centers only — no terrain or illumination. Main area has a 3-column KPI strip showing Sun-Earth, Earth-Moon, and Sun-Moon distances in km; a large primary 3D orbital viewport on #0B101B showing glowing Solar Amber (#F59E0B), Earth Cyan (#38BDF8), and Moon Silver (#CBD5E1) markers on subtle 3D grid axes, with a crisp docked bottom-right scale inset panel (#131B2E with #38BDF8 border) showing the secondary Earth-Moon view and a Swap View button; and a compact bottom coordinates table (Body, X km, Y km, Z km, Distance km) with Export CSV and Export JSON buttons."
