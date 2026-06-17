/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the catalog API. Defaults to `/api/v1` when unset. */
  readonly VITE_API_BASE_URL?: string
  /**
   * Optional observability sink endpoint. When set, the frontend logger POSTs
   * warn/error entries to this URL (fire-and-forget). Off by default for the
   * trusted-LAN deployment; leave unset to keep logging console-only.
   */
  readonly VITE_LOG_SINK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
