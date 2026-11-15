"""Generate publication-grade scientific, architecture, and gameplay diagrams for ILARGI docs."""

from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "diagrams"

# Clean scientific palette (light, high-contrast, color-blind aware)
BG = "#FFFFFF"
PANEL_BG = "#F8FAFC"
BORDER = "#CBD5E1"
INK = "#0F172A"
MUTED = "#475569"
BLUE = "#2563EB"
SKY = "#0284C7"
AMBER = "#D97706"
GOLD = "#F59E0B"
TEAL = "#0D9488"
EMERALD = "#059669"
ROSE = "#E11D48"
SLATE = "#64748B"
VIOLET = "#7C3AED"


def _configure_matplotlib() -> None:
    plt.rcParams.update(
        {
            "figure.facecolor": BG,
            "axes.facecolor": PANEL_BG,
            "axes.edgecolor": BORDER,
            "axes.labelcolor": INK,
            "xtick.color": MUTED,
            "ytick.color": MUTED,
            "text.color": INK,
            "font.family": "DejaVu Sans",
            "mathtext.fontset": "cm",
        }
    )


def build_horizon_and_disc_figure(out_path: Path) -> None:
    fig, (ax_ray, ax_disc) = plt.subplots(
        1, 2, figsize=(13.8, 6.1), dpi=240, gridspec_kw={"width_ratios": [1.18, 1.0]}
    )
    fig.subplots_adjust(left=0.055, right=0.975, top=0.81, bottom=0.125, wspace=0.22)

    fig.suptitle(
        "ILARGI Scientific Geometry: Spherical Ray Tracing & Finite-Disc Visibility",
        fontsize=14.5,
        fontweight="bold",
        color=INK,
        y=0.955,
    )
    fig.text(
        0.5,
        0.89,
        r"Frame: $\mathrm{MOON\_ME\_DE440\_ME421}$ ($\mathrm{LT+S}$)  ·  Reference Sphere: $R = 1{,}737.4\ \mathrm{km}$  ·  LOLA Extrema: $[-9{,}129\ \mathrm{m},\ +10{,}792\ \mathrm{m}]$",
        ha="center",
        fontsize=10,
        color=MUTED,
    )

    # ── LEFT PANEL: Curved-Moon Ray Tracing & Multi-DEM Cascade ────────────────
    d_km = np.linspace(0, 120, 500)
    r_m = 1_737_400.0
    curv_drop_m = -0.5 * (d_km * 1000.0) ** 2 / r_m * 0.55

    terrain_rel_m = (
        180.0 * np.sin(d_km * 0.085)
        + 420.0 * np.exp(-(((d_km - 56.0) / 10.5) ** 2))
        + 120.0 * np.exp(-(((d_km - 24.0) / 5.5) ** 2))
        - 160.0 * np.exp(-(((d_km - 86.0) / 12.0) ** 2))
    )
    elev_plot = curv_drop_m + terrain_rel_m

    ax_ray.axvspan(0, 40, color="#CCFBF1", alpha=0.52, zorder=0)
    ax_ray.axvspan(40, 100, color="#EDE9FE", alpha=0.42, zorder=0)
    ax_ray.axvspan(100, 122, color="#F1F5F9", alpha=0.85, zorder=0)

    ax_ray.text(
        20,
        -2020,
        "Fine DEM\n(20 m / 80 m)",
        ha="center",
        va="bottom",
        fontsize=8.5,
        fontweight="bold",
        color=TEAL,
    )
    ax_ray.text(
        70,
        -2020,
        "Coarse / Global DEM (~237 m)\nqueried only if horizon allows",
        ha="center",
        va="bottom",
        fontsize=8.5,
        fontweight="bold",
        color=VIOLET,
    )

    ax_ray.plot(
        d_km,
        curv_drop_m,
        linestyle="--",
        color=SLATE,
        linewidth=1.2,
        label=r"Reference sphere ($R = 1{,}737.4\ \mathrm{km}$)",
    )
    mask_valid = d_km <= 100.0
    ax_ray.fill_between(
        d_km[mask_valid],
        -2150,
        elev_plot[mask_valid],
        color="#E2E8F0",
        edgecolor="#475569",
        linewidth=1.8,
        zorder=2,
    )

    # Nodata / raster boundary placed cleanly inside panel
    ax_ray.axvline(100, color=ROSE, linestyle=":", linewidth=1.7, zorder=3)
    ax_ray.text(
        101.8,
        -450,
        "nodata / edge\nstop\n(coverage_m)",
        color=ROSE,
        fontsize=8.3,
        fontweight="bold",
        va="top",
        ha="left",
    )

    obs_y = elev_plot[0] + 220
    ax_ray.plot([0, 0], [elev_plot[0], obs_y], color=BLUE, linewidth=2.4, zorder=4)
    ax_ray.scatter([0], [obs_y], color=BLUE, s=55, zorder=5)
    ax_ray.annotate(
        r"Observer ($h_{\mathrm{obs}} = h_{\mathrm{DEM}} + h_{\mathrm{inst}}$)",
        xy=(0.5, obs_y + 15),
        xytext=(5.5, obs_y + 420),
        arrowprops={"arrowstyle": "->", "color": BLUE, "lw": 1.1},
        fontsize=8.8,
        fontweight="bold",
        color=BLUE,
    )

    ax_ray.axhline(obs_y, xmin=0.0, xmax=0.825, color=MUTED, linestyle="-.", lw=1.0)
    ax_ray.text(76, obs_y + 70, r"$0^\circ$ tangent plane", fontsize=8.2, color=MUTED)

    ridge_idx = int(np.argmin(np.abs(d_km - 56.0)))
    rx, ry = d_km[ridge_idx], elev_plot[ridge_idx]
    slope = (ry - obs_y) / rx
    ax_ray.plot(
        [0, 96],
        [obs_y, obs_y + slope * 96],
        color=AMBER,
        linewidth=2.0,
        zorder=4,
        label=r"Horizon ray $\alpha_{\max}$ (max obstacle)",
    )
    ax_ray.scatter([rx], [ry], color=AMBER, s=48, zorder=5)
    ax_ray.annotate(
        "Max obstacle ridge",
        xy=(rx, ry),
        xytext=(rx - 14, ry + 540),
        arrowprops={"arrowstyle": "->", "color": AMBER, "lw": 1.2},
        fontsize=8.6,
        fontweight="bold",
        color=AMBER,
    )

    # Target Sun ray and cleanly separated badge
    ax_ray.annotate(
        "",
        xy=(88, 1280),
        xytext=(0, obs_y),
        arrowprops={"arrowstyle": "->", "color": GOLD, "lw": 2.0},
        zorder=4,
    )
    ax_ray.scatter(
        [91], [1320], color=GOLD, s=165, edgecolors=AMBER, linewidth=1.4, zorder=5
    )
    ax_ray.text(
        82,
        1490,
        r"Apparent target ($\mathrm{margin} = \mathrm{el} - \alpha_{\max}$)",
        ha="center",
        fontsize=8.6,
        fontweight="bold",
        color=INK,
        bbox={"boxstyle": "round,pad=0.25", "fc": "#FEF3C7", "ec": GOLD, "lw": 0.9},
    )

    ax_ray.text(
        4,
        -1330,
        r"$\mathrm{elev} = \operatorname{atan2}\!\left((R+h)\cos\theta - (R+h_{\mathrm{obs}}),\ (R+h)\sin\theta\right)$"
        + "\n"
        + r"Occultation bound: $r_{\max}\cos(\alpha + \theta) = r_{\mathrm{obs}}\cos(\alpha)$",
        fontsize=8.3,
        color=INK,
        bbox={"boxstyle": "round,pad=0.35", "fc": "#FFFFFF", "ec": BORDER, "lw": 1.0},
    )

    ax_ray.set_title(
        "1. Curved-Moon Horizon & Multi-DEM Cascade",
        fontsize=11.5,
        fontweight="bold",
        pad=10,
    )
    ax_ray.set_xlabel("Great-circle distance along azimuth (km)", fontsize=9.5)
    ax_ray.set_ylabel("Vertical profile (schematic curvature scale)", fontsize=9.5)
    ax_ray.set_xlim(-3, 122)
    ax_ray.set_ylim(-2150, 1780)
    ax_ray.set_yticks([])
    ax_ray.legend(
        loc="upper left",
        fontsize=8.0,
        frameon=True,
        facecolor="#FFFFFF",
        edgecolor=BORDER,
    )

    # ── RIGHT PANEL: Actual 61x61 Finite-Disc Grid & Classification ────────────
    n = 61
    axis = (np.arange(n) + 0.5) * 2.0 / n - 1.0
    gx, gy = np.meshgrid(axis, axis)
    inside = gx * gx + gy * gy < 1.0
    x_pts = gx[inside] * 0.265
    y_pts = gy[inside] * 0.265

    h_curve = -0.055 + 0.045 * np.sin(x_pts * 9.0 + 0.4) + 0.03 * np.cos(x_pts * 5.0)
    earth_cx, earth_cy, earth_r = 0.14, 0.09, 0.20
    in_earth = (x_pts - earth_cx) ** 2 + (y_pts - earth_cy) ** 2 <= earth_r**2
    above_hor = y_pts > h_curve

    visible = above_hor & (~in_earth)
    eclipsed = above_hor & in_earth
    terrain_occ = ~above_hor

    ax_disc.scatter(
        x_pts[visible],
        y_pts[visible],
        s=9,
        color=GOLD,
        alpha=0.92,
        label="Direct visible",
    )
    ax_disc.scatter(
        x_pts[eclipsed],
        y_pts[eclipsed],
        s=9,
        color=ROSE,
        alpha=0.88,
        label="Earth eclipsed",
    )
    ax_disc.scatter(
        x_pts[terrain_occ],
        y_pts[terrain_occ],
        s=9,
        color=SLATE,
        alpha=0.72,
        label="Terrain occulted",
    )

    hx = np.linspace(-0.41, 0.41, 200)
    hy = -0.055 + 0.045 * np.sin(hx * 9.0 + 0.4) + 0.03 * np.cos(hx * 5.0)
    ax_disc.fill_between(hx, -0.42, hy, color="#CBD5E1", alpha=0.36, zorder=1)
    ax_disc.plot(
        hx, hy, color=TEAL, linewidth=2.2, label="Interpolated LOLA horizon", zorder=4
    )

    earth_circle = mpatches.Circle(
        (earth_cx, earth_cy),
        earth_r,
        fill=False,
        edgecolor=BLUE,
        linestyle="--",
        linewidth=1.8,
        zorder=5,
        label=r"Earth disc ($R_\oplus = 6{,}371\ \mathrm{km}$)",
    )
    ax_disc.add_patch(earth_circle)
    ax_disc.text(
        earth_cx + 0.06,
        earth_cy + 0.22,
        "Earth angular disc",
        color=BLUE,
        fontsize=8.4,
        fontweight="bold",
        ha="center",
    )

    ax_disc.text(
        0.0,
        -0.375,
        r"Grid: $61 \times 61$ circular samples ($\approx 2{,}921$ rays)  ·  Missing horizon $\rightarrow$ $\mathrm{NaN}$",
        ha="center",
        fontsize=8.2,
        color=MUTED,
        bbox={"boxstyle": "round,pad=0.25", "fc": "#FFFFFF", "ec": BORDER, "lw": 0.9},
    )

    ax_disc.set_title(
        "2. Finite-Disc Grid & Eclipse State Coloring",
        fontsize=11.5,
        fontweight="bold",
        pad=10,
    )
    ax_disc.set_xlabel(
        r"Cross-azimuth offset $\Delta\mathrm{Az}\cdot\cos(\mathrm{el})$ (deg)",
        fontsize=9.5,
    )
    ax_disc.set_ylabel(r"Elevation offset $\Delta\mathrm{El}$ (deg)", fontsize=9.5)
    ax_disc.set_xlim(-0.41, 0.41)
    ax_disc.set_ylim(-0.42, 0.47)
    ax_disc.set_aspect("equal")
    ax_disc.grid(True, color="#E2E8F0", linewidth=0.7)
    ax_disc.legend(
        loc="upper left",
        ncol=2,
        fontsize=7.6,
        frameon=True,
        facecolor="#FFFFFF",
        edgecolor=BORDER,
        markerscale=1.5,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=240)
    plt.close(fig)


def build_landing_game_figure(out_path: Path) -> None:
    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(14.6, 5.1), dpi=240)
    fig.subplots_adjust(left=0.055, right=0.985, top=0.78, bottom=0.14, wspace=0.27)

    fig.suptitle(
        "Lunar Landing Game — Three-Phase Mechanics & Envelope (gamePhysics.ts)",
        fontsize=14.5,
        fontweight="bold",
        color=INK,
        y=0.95,
    )
    fig.text(
        0.5,
        0.875,
        r"Idealized Educational Model: $R = 1{,}737.4\ \mathrm{km}$  ·  $\mu = 4.9028 \times 10^{12}\ \mathrm{m}^3/\mathrm{s}^2$  ·  $g = 1.622\ \mathrm{m}/\mathrm{s}^2$  (separate from SPICE + LOLA science engine)",
        ha="center",
        fontsize=9.8,
        color=MUTED,
    )

    # ── PHASE 1: Plane Change ΔV vs Target Latitude ────────────────────────────
    lats = np.linspace(0, 90, 200)
    r_orb = 1_737_400.0 + 110_000.0
    v_circ = np.sqrt(4.9028e12 / r_orb)
    dv_plane = 2.0 * v_circ * np.sin(np.deg2rad(lats) / 2.0)

    ax1.plot(lats, dv_plane, color=BLUE, linewidth=2.3)
    ax1.fill_between(lats, 0, dv_plane, color="#DBEAFE", alpha=0.55)

    example_sites = [
        ("Apollo 17", 20.19, AMBER, 5, -260, "left"),
        ("Chang'e 4", 45.46, VIOLET, 5, -260, "left"),
        ("Mons Mouton", 85.43, TEAL, -6, 120, "right"),
    ]
    for name, lat_v, col, dx, dy, ha_align in example_sites:
        dv_v = 2.0 * v_circ * np.sin(np.deg2rad(lat_v) / 2.0)
        ax1.scatter(
            [lat_v], [dv_v], color=col, s=58, zorder=5, edgecolor="#FFFFFF", lw=1.0
        )
        ax1.text(
            lat_v + dx,
            dv_v + dy,
            f"{name}\n({lat_v:.1f}°)",
            fontsize=7.9,
            fontweight="bold",
            color=col,
            ha=ha_align,
        )

    ax1.text(
        5,
        2140,
        r"$i_{\mathrm{req}} = |\phi|$"
        + "\n"
        + r"$\Delta V = 2v_{\mathrm{circ}}\sin(\Delta i/2)$",
        fontsize=8.5,
        bbox={"boxstyle": "round,pad=0.3", "fc": "#FFFFFF", "ec": BORDER},
    )
    ax1.set_title(
        "Phase 1: Plane Change from i = 0°", fontsize=11, fontweight="bold", pad=8
    )
    ax1.set_xlabel(r"Target |Latitude| $|\phi|$ (deg)", fontsize=9)
    ax1.set_ylabel(r"Required $\Delta V_{\mathrm{plane}}$ (m/s)", fontsize=9)
    ax1.set_xlim(0, 93)
    ax1.set_ylim(0, 2650)
    ax1.grid(True, color="#E2E8F0", linewidth=0.7)

    # ── PHASE 2: Hohmann Descent Velocity Profile ──────────────────────────────
    mu = 4.9028e12
    r1 = 1_737_400.0 + 108_000.0
    r2 = 1_737_400.0 + 8_000.0
    a_t = 0.5 * (r1 + r2)
    alt_km = np.linspace(108.0, 8.0, 200)
    r_vec = 1_737_400.0 + alt_km * 1000.0
    v_transfer = np.sqrt(mu * (2.0 / r_vec - 1.0 / a_t))
    v_circ_curve = np.sqrt(mu / r_vec)

    ax2.plot(
        alt_km,
        v_circ_curve,
        color=SLATE,
        linestyle="--",
        linewidth=1.5,
        label=r"Circular speed $v_{\mathrm{circ}}(h)$",
    )
    ax2.plot(
        alt_km,
        v_transfer,
        color=AMBER,
        linewidth=2.4,
        label="Elliptical transfer speed",
    )
    ax2.fill_between(alt_km, v_transfer, v_circ_curve, color="#FEF3C7", alpha=0.58)

    ax2.axvline(108, color=BLUE, linestyle=":", lw=1.4)
    ax2.axvline(8, color=EMERALD, linestyle=":", lw=1.5)
    # Inverted xlim: left is 116 km, right is -2 km
    ax2.text(
        105.5,
        1672,
        "Orbit\n108 km",
        ha="left",
        fontsize=8.0,
        color=BLUE,
        fontweight="bold",
    )
    ax2.text(
        10.5,
        1648,
        "Gate\n8 km",
        ha="right",
        fontsize=8.0,
        color=EMERALD,
        fontweight="bold",
    )

    ax2.annotate(
        r"Deorbit burn $\Delta V_1$",
        xy=(108, v_transfer[0]),
        xytext=(84, 1603),
        arrowprops={"arrowstyle": "->", "color": AMBER, "lw": 1.3},
        fontsize=8.3,
        fontweight="bold",
        color=AMBER,
    )
    ax2.text(
        56,
        1627,
        r"Keypad check:" + "\n" + r"$\Delta h = h_{\mathrm{orb}} - h_{\mathrm{gate}}$",
        ha="center",
        fontsize=8.2,
        bbox={"boxstyle": "round,pad=0.3", "fc": "#FFFFFF", "ec": BORDER},
    )
    ax2.set_title(
        "Phase 2: Descent & Two-Impulse ΔV", fontsize=11, fontweight="bold", pad=8
    )
    ax2.set_xlabel("Altitude above reference sphere (km)", fontsize=9)
    ax2.set_ylabel("Orbital speed (m/s)", fontsize=9)
    ax2.set_xlim(116, -2)
    ax2.set_ylim(1595, 1712)
    ax2.grid(True, color="#E2E8F0", linewidth=0.7)
    ax2.legend(
        loc="upper left",
        fontsize=7.8,
        frameon=True,
        facecolor="#FFFFFF",
        edgecolor=BORDER,
    )

    # ── PHASE 3: Terminal Touchdown Envelope ───────────────────────────────────
    ax3.axvspan(0, 17, ymin=0, ymax=4.5 / 12.0, color="#D1FAE5", alpha=0.85, zorder=1)
    ax3.axvspan(0, 17, ymin=4.5 / 12.0, ymax=1.0, color="#FEF3C7", alpha=0.7, zorder=1)
    ax3.axvspan(17, 35, color="#FFE4E6", alpha=0.7, zorder=1)

    ax3.axvline(15, color=TEAL, linestyle="--", lw=1.3, label="Circle radius (15 m)")
    ax3.axvline(17, color=EMERALD, linestyle="-", lw=2.0, label="Max win radius (17 m)")
    ax3.axhline(
        4.5, color=ROSE, linestyle="-", lw=2.0, label=r"Max safe $|v_z|$ (4.5 m/s)"
    )

    ax3.text(
        8.5,
        2.25,
        "SUCCESSFUL\nLANDING\n(Win)",
        ha="center",
        va="center",
        fontsize=9,
        fontweight="bold",
        color="#065F46",
    )
    ax3.text(
        8.5,
        8.2,
        "HARD LANDING\n(Hold SPACE\nto brake)",
        ha="center",
        va="center",
        fontsize=8.5,
        fontweight="bold",
        color="#92400E",
    )
    ax3.text(
        26,
        5.5,
        "MISSED\nTARGET\n(Use WASD /\nArrows)",
        ha="center",
        va="center",
        fontsize=8.5,
        fontweight="bold",
        color="#9F1239",
    )

    ax3.set_title(
        "Phase 3: Terminal Touchdown Envelope", fontsize=11, fontweight="bold", pad=8
    )
    ax3.set_xlabel("Touchdown radial error from center (m)", fontsize=9)
    ax3.set_ylabel(r"Vertical touchdown speed $|v_z|$ (m/s)", fontsize=9)
    ax3.set_xlim(0, 35)
    ax3.set_ylim(0, 12)
    ax3.grid(True, color="#E2E8F0", linewidth=0.7)
    ax3.legend(
        loc="upper right",
        fontsize=7.6,
        frameon=True,
        facecolor="#FFFFFF",
        edgecolor=BORDER,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=240)
    plt.close(fig)


def _draw_block(
    ax: plt.Axes,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    subtitle: str,
    fc: str,
    ec: str,
    title_color: str = INK,
    ls: str = "-",
    pad: float = 0.004,
) -> None:
    box = mpatches.FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle=f"round,pad={pad},rounding_size=0.014",
        facecolor=fc,
        edgecolor=ec,
        linewidth=1.7,
        linestyle=ls,
        zorder=3,
    )
    ax.add_patch(box)
    ax.text(
        x + w / 2,
        y + h * 0.64,
        title,
        ha="center",
        va="center",
        fontsize=9.1,
        fontweight="bold",
        color=title_color,
        zorder=4,
    )
    ax.text(
        x + w / 2,
        y + h * 0.28,
        subtitle,
        ha="center",
        va="center",
        fontsize=7.7,
        color=MUTED,
        zorder=4,
    )


def _draw_arrow(
    ax: plt.Axes,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    color: str = SLATE,
    ls: str = "-",
    label: str = "",
    lx_off: float = 0.0,
    ly_off: float = 0.0,
) -> None:
    ax.annotate(
        "",
        xy=(x2, y2),
        xytext=(x1, y1),
        arrowprops={
            "arrowstyle": "->,head_width=0.28,head_length=0.38",
            "color": color,
            "lw": 1.6,
            "linestyle": ls,
        },
        zorder=2,
    )
    if label:
        ax.text(
            (x1 + x2) / 2 + lx_off,
            (y1 + y2) / 2 + ly_off,
            label,
            ha="center",
            va="center",
            fontsize=7.6,
            fontweight="bold",
            color=color,
            bbox={
                "boxstyle": "round,pad=0.16",
                "fc": "#FFFFFF",
                "ec": "none",
                "alpha": 0.92,
            },
            zorder=5,
        )


def build_architecture_and_states_figure(out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(14.4, 7.3), dpi=240)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.86, bottom=0.03)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.set_facecolor(BG)

    fig.suptitle(
        "ILARGI System Architecture, Block Semantics & Hybrid Cloud State Transitions",
        fontsize=14.5,
        fontweight="bold",
        color=INK,
        y=0.96,
    )
    fig.text(
        0.5,
        0.905,
        "Color encodes subsystem role and runtime activation path across Cloud Run, Cloudflare Pages, and client-side modes",
        ha="center",
        fontsize=10,
        color=MUTED,
    )

    # ── Top Legend Bar (When & Why Blocks Are Colored) ─────────────────────────
    legend_items = [
        ("#EDE9FE", VIOLET, "NASA / NAIF / PDS Data", "SHA-256 verified inputs"),
        ("#FEF3C7", AMBER, "Python SPICE & LOLA Engine", "Active on Cloud Run / local"),
        ("#DBEAFE", BLUE, "FastAPI + Cloudflare UI", "Always active in browser & API"),
        (
            "#D1FAE5",
            EMERALD,
            "Resilient Demo Catalog",
            "Active on >8s/25s timeout or 5xx",
        ),
        (
            "#FFE4E6",
            ROSE,
            "Client Sim / Concurrency Guard",
            "Local browser physics or 503",
        ),
    ]
    lx = 0.015
    lw = 0.184
    gap = 0.012
    for fc, ec, title, desc in legend_items:
        _draw_block(
            ax, lx, 0.865, lw, 0.095, title, desc, fc, ec, title_color=INK, pad=0.002
        )
        lx += lw + gap

    # ── Column 1: Authoritative & Display Data Sources ─────────────────────────
    ax.text(
        0.115,
        0.815,
        "1. DATA SOURCES",
        ha="center",
        fontsize=9.5,
        fontweight="bold",
        color=VIOLET,
    )
    _draw_block(
        ax,
        0.02,
        0.66,
        0.19,
        0.115,
        "NAIF SPICE Kernels",
        "DE440s · LSK · FK · PCK (~45 MB)",
        "#EDE9FE",
        VIOLET,
    )
    _draw_block(
        ax,
        0.02,
        0.50,
        0.19,
        0.115,
        "LRO LOLA DEMs",
        "20m / 80m crops + optional 2.3 GB",
        "#EDE9FE",
        VIOLET,
    )
    _draw_block(
        ax,
        0.02,
        0.34,
        0.19,
        0.115,
        "LP-GRS & WEH Grids",
        "5° geochemistry · 0.5° hydrogen",
        "#EDE9FE",
        VIOLET,
    )
    _draw_block(
        ax,
        0.02,
        0.11,
        0.19,
        0.115,
        "SVS CGI Moon Kit",
        "8 px/deg display mesh + texture",
        "#EDE9FE",
        VIOLET,
        ls="--",
    )

    # ── Column 2: Python Scientific Engine (Google Cloud Run / Local) ──────────
    cloud_bg = mpatches.FancyBboxPatch(
        (0.255, 0.155),
        0.255,
        0.675,
        boxstyle="round,pad=0.008,rounding_size=0.018",
        facecolor="#FFFBEB",
        edgecolor=AMBER,
        linewidth=1.4,
        linestyle="--",
        zorder=1,
    )
    ax.add_patch(cloud_bg)
    ax.text(
        0.382,
        0.815,
        "2. GOOGLE CLOUD RUN (europe-west1)",
        ha="center",
        fontsize=9.2,
        fontweight="bold",
        color=AMBER,
    )

    _draw_block(
        ax,
        0.275,
        0.66,
        0.215,
        0.115,
        "ephemeris.py + apparent.py",
        "RLock SPICE · LT+S MOON_ME",
        "#FEF3C7",
        AMBER,
    )
    _draw_block(
        ax,
        0.275,
        0.50,
        0.215,
        0.115,
        "terrain.py + horizon.py",
        "Curved-Moon rays · Multi-DEM",
        "#FEF3C7",
        AMBER,
    )
    _draw_block(
        ax,
        0.275,
        0.34,
        0.215,
        0.115,
        "analysis.py + discs.py",
        "61×61 eclipse · events · education",
        "#FEF3C7",
        AMBER,
    )
    _draw_block(
        ax,
        0.275,
        0.175,
        0.215,
        0.115,
        "api.py Lock & Batch Guard",
        "1 worker · <=25k steps · 503 if busy",
        "#FFE4E6",
        ROSE,
    )

    # ── Column 3: Hybrid Transport & Resilient State Router ────────────────────
    ax.text(
        0.625,
        0.815,
        "3. HYBRID DATA ROUTER",
        ha="center",
        fontsize=9.5,
        fontweight="bold",
        color=BLUE,
    )
    _draw_block(
        ax,
        0.54,
        0.65,
        0.17,
        0.125,
        "FastAPI REST JSON",
        "HTTPS · Explicit CORS · 1 vCPU/2 GiB",
        "#DBEAFE",
        BLUE,
    )
    _draw_block(
        ax,
        0.54,
        0.415,
        0.17,
        0.135,
        "dataSource.ts (auto)",
        "8s GET / 25s POST timeout\n4xx shown directly · 5xx -> fallback",
        "#DBEAFE",
        BLUE,
    )
    _draw_block(
        ax,
        0.54,
        0.175,
        0.17,
        0.135,
        "/demo/*.json Fallback",
        "export_demo.py · SHA-256 catalog\n2026-04-02T15:00Z + Notice",
        "#D1FAE5",
        EMERALD,
        ls="--",
    )

    # ── Column 4: Cloudflare Pages Frontend (Browser) ──────────────────────────
    cf_bg = mpatches.FancyBboxPatch(
        (0.75, 0.08),
        0.23,
        0.75,
        boxstyle="round,pad=0.008,rounding_size=0.018",
        facecolor="#F0F9FF",
        edgecolor=SKY,
        linewidth=1.4,
        linestyle="--",
        zorder=1,
    )
    ax.add_patch(cf_bg)
    ax.text(
        0.865,
        0.815,
        "4. CLOUDFLARE PAGES (ilargi.pages.dev)",
        ha="center",
        fontsize=9.0,
        fontweight="bold",
        color=SKY,
    )

    _draw_block(
        ax,
        0.77,
        0.645,
        0.19,
        0.12,
        "Mission Analysis",
        "1–10 sites · Plotly · 61×61 disc",
        "#DBEAFE",
        BLUE,
    )
    _draw_block(
        ax,
        0.77,
        0.47,
        0.19,
        0.12,
        "Education Mode",
        "Synodic cycle · 3-Body · WEH",
        "#DBEAFE",
        BLUE,
    )
    _draw_block(
        ax,
        0.77,
        0.295,
        0.19,
        0.12,
        "Three.js 3D Globe",
        "+Y North · Mineral / WEH layers",
        "#DBEAFE",
        BLUE,
    )
    _draw_block(
        ax,
        0.77,
        0.11,
        0.19,
        0.115,
        "Lunar Landing Game",
        "100% client-side (gamePhysics.ts)",
        "#FFE4E6",
        ROSE,
    )

    # ── Arrows Connecting Everything ───────────────────────────────────────────
    _draw_arrow(ax, 0.21, 0.717, 0.275, 0.717, VIOLET)
    _draw_arrow(ax, 0.21, 0.557, 0.275, 0.557, VIOLET)
    _draw_arrow(ax, 0.21, 0.397, 0.275, 0.397, VIOLET)

    # Display mesh routed cleanly below Column 2 & Column 3 to Three.js 3D Globe
    ax.plot(
        [0.115, 0.115, 0.735, 0.735],
        [0.11, 0.055, 0.055, 0.34],
        color=SLATE,
        lw=1.5,
        ls="--",
        zorder=2,
    )
    _draw_arrow(ax, 0.735, 0.34, 0.77, 0.34, SLATE, ls="--")
    ax.text(
        0.43,
        0.025,
        "Display-only mesh (moon_height.bin.gz) — decoupled from scientific DEM calculations",
        ha="center",
        fontsize=8.1,
        color=MUTED,
        style="italic",
    )

    _draw_arrow(ax, 0.49, 0.397, 0.54, 0.70, AMBER)
    _draw_arrow(ax, 0.49, 0.717, 0.54, 0.717, AMBER)
    _draw_arrow(ax, 0.382, 0.34, 0.382, 0.29, ROSE)
    _draw_arrow(
        ax,
        0.49,
        0.23,
        0.54,
        0.46,
        ROSE,
        ls="--",
        label="503",
        lx_off=-0.005,
        ly_off=0.015,
    )

    _draw_arrow(ax, 0.625, 0.65, 0.625, 0.55, BLUE, label="HTTP 200")
    _draw_arrow(ax, 0.625, 0.415, 0.625, 0.31, EMERALD, ls="--", label="Timeout / 5xx")

    _draw_arrow(ax, 0.71, 0.51, 0.77, 0.705, BLUE)
    _draw_arrow(ax, 0.71, 0.485, 0.77, 0.53, BLUE)
    _draw_arrow(ax, 0.71, 0.46, 0.77, 0.36, BLUE)
    _draw_arrow(ax, 0.71, 0.26, 0.77, 0.51, EMERALD, ls="--")
    _draw_arrow(ax, 0.71, 0.24, 0.77, 0.68, EMERALD, ls="--")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=240)
    plt.close(fig)


def main() -> None:
    _configure_matplotlib()
    build_horizon_and_disc_figure(OUT_DIR / "lunar_horizon_and_disc.png")
    build_landing_game_figure(OUT_DIR / "landing_game_mechanics.png")
    build_architecture_and_states_figure(OUT_DIR / "system_architecture_and_states.png")
    print(f"Generated figures in {OUT_DIR}")


if __name__ == "__main__":
    main()
