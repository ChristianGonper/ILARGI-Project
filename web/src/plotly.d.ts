declare module "plotly.js-gl2d-dist-min" {
  const Plotly: {
    react: (
      root: HTMLElement,
      data: Record<string, unknown>[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>,
    ) => Promise<void>;
    purge: (root: HTMLElement) => void;
  };
  export default Plotly;
}
