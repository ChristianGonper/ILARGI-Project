# Project concept and scope

ILARGI was conceived for the NASA Space Apps Lunar Landing Site Navigator challenge. The initial working concept, dated 2026-11-11, proposed a common scientific engine for educational and technical exploration of lunar sites, particularly near the south pole.

A scenario specifies a site, UTC start time, duration, instrument height and sampling. The technical explorer compares apparent Sun and Earth directions with a sampled terrain horizon, reports center-visibility events and intervals, and separately estimates geometric disc fractions. Regional element abundance and hydrogen maps provide context, not extractable-resource assessments.

A central use case is comparing a site before and after a date change. Aggregate percentages should be considered together with continuous dark intervals: two sites with equal total visibility may have very different interruptions. Mission-specific ranking, operational thresholds and uncertainty propagation remain future work.

The educational experience illustrates the same geometry and includes a simplified landing game. It does not propagate a mission trajectory or certify a landing. Power production, thermal behavior, Earth-station radio links and operational safety are outside the current scientific model.

SPICE provides downloaded, repeatable ephemerides; Horizons supplies external comparison cases. Rasterio, PROJ and NumPy handle terrain and geometry. React, Three.js and Plotly.js implement the current web interface. Earlier suggestions such as Cesium, Astroquery, Numba, Zarr and multiobjective optimizers were possibilities, not requirements. See [sources](sources.md) and [development](development.md).
