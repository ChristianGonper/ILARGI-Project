import Plotly from "plotly.js-gl2d-dist-min";
export function animateTracks(
  root: HTMLElement,
  traces: Record<string, unknown>[],
  layout: Record<string, unknown>,
) {
  let cancelled = false;
  let timer = 0;
  const moving = traces
    .map((trace, index) => ({ trace, index }))
    .filter(({ trace }) => trace.name === "Sun" || trace.name === "Earth");
  const start = performance.now();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = async () => {
    if (cancelled) return;
    const progress = reduced
      ? 1
      : Math.min(1, (performance.now() - start) / 6500);
    const frame = traces.map((trace) => ({ ...trace }));
    for (const { trace, index } of moving) {
      const x = trace.x as (number | string | null)[];
      const y = trace.y as (number | null)[];
      const count = Math.floor(progress * x.length);
      frame[index] = {
        ...trace,
        mode: "lines",
        x: x.slice(0, count),
        y: y.slice(0, count),
        customdata: (trace.customdata as unknown[] | undefined)?.slice(
          0,
          count,
        ),
      };
      if (count > 0)
        frame.push({
          x: [x[count - 1]],
          y: [y[count - 1]],
          type: "scatter",
          mode: "text",
          text: [trace.name === "Sun" ? "\u2600" : "\ud83c\udf0d"],
          textfont: { size: 22 },
          showlegend: false,
          hoverinfo: "skip",
        });
    }
    await Plotly.react(root, frame, layout, {
      responsive: true,
      displaylogo: false,
    });
    if (!cancelled && progress < 1)
      timer = window.setTimeout(() => {
        void draw();
      }, 70);
  };
  void draw();
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    Plotly.purge(root);
  };
}
