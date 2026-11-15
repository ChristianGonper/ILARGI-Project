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
  return (
    <div className="data-source-notice" role="status">
      <span>
        {source === "static"
          ? "Saved scientific demo · Some results are precomputed. Catalog sites · 2 Apr 2026, 15:00 UTC. Custom requests need the live API."
          : source === "live"
            ? "Live scientific API connected"
            : "Connecting to the scientific API…"}
      </span>
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
      {source === "static" && (
        <button type="button" className="btn-mini" onClick={retryLiveData}>
          Reconnect API
        </button>
      )}
      <a href="/sources.md" target="_blank" rel="noreferrer">
        Data sources
      </a>
    </div>
  );
}
