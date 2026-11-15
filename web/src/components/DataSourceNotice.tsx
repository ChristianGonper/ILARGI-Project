import { useSyncExternalStore } from "react";
import {
  getDataSource,
  retryLiveData,
  subscribeDataSource,
  useSavedData,
} from "../dataSource";

export function DataSourceNotice({
  onLoadDemo,
  ready,
}: {
  onLoadDemo: () => void;
  ready: boolean;
}) {
  const source = useSyncExternalStore(subscribeDataSource, getDataSource);
  if (source !== "static") return null;
  return (
    <div className="data-source-notice" role="status">
      <p>
        You're exploring the demo with precomputed results. Live calculations
        are currently unavailable.
      </p>
      <p className="demo-details">Catalog sites · 2 Apr 2026, 15:00 UTC.</p>
      <div className="demo-actions">
        <button
          type="button"
          className="btn-mini"
          disabled={!ready}
          onClick={() => {
            useSavedData();
            onLoadDemo();
          }}
        >
          Load demo settings
        </button>
        <button type="button" className="btn-mini" onClick={retryLiveData}>
          Try again
        </button>
      </div>
    </div>
  );
}
