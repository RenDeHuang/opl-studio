export const codexWorkbenchStyleRuntimeOverview = `  .runtime-snapshot-note {
    margin: 8px 0 0;
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
    line-height: var(--opl-leading-normal);
  }

  .runtime-snapshot-note[data-source="cached"] {
    color: var(--opl-muted);
  }

  .runtime-snapshot-note[data-source="live"]::before,
  .runtime-snapshot-note[data-source="cached"]::before {
    content: "";
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    background: currentColor;
    vertical-align: 1px;
  }

  .opl-recent-session-list > * + * {
    margin-top: 2px;
  }

  .opl-runtime-overview {
    min-width: 0;
    min-height: 100%;
    overflow: auto;
    padding: var(--opl-space-6) clamp(20px, 3.2vw, 44px) 32px;
    background: var(--opl-canvas);
    color: var(--opl-text);
    font-size: var(--opl-text-md);
    line-height: var(--opl-leading-normal);
  }

  .runtime-overview-header,
  .runtime-overview-header > div,
  .runtime-list-heading,
  .runtime-list-heading > div,
  .runtime-list-controls,
  .runtime-work-identity > span,
  .runtime-work-identity > button > span,
  .runtime-stage-button,
  .runtime-stage-popover > header,
  .runtime-work-time {
    display: flex;
    align-items: center;
  }

  .runtime-overview-header {
    justify-content: space-between;
    gap: var(--opl-space-4);
    min-height: 36px;
  }

  .runtime-overview-header > div {
    gap: var(--opl-space-2);
    min-width: 0;
  }

  .runtime-overview-header h1 {
    margin: 0;
    font-size: var(--opl-text-xl);
    line-height: var(--opl-leading-tight);
    font-weight: var(--opl-weight-semibold);
    letter-spacing: 0;
  }

  .runtime-icon-button,
  .runtime-stage-popover > header button {
    flex: 0 0 var(--opl-control-md);
    width: var(--opl-control-md);
    height: var(--opl-control-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--opl-border);
    border-radius: var(--opl-radius-control);
    background: var(--opl-canvas);
    color: var(--opl-muted);
  }

  .runtime-icon-button:hover,
  .runtime-stage-popover > header button:hover {
    background: var(--opl-hover);
    color: var(--opl-text);
  }

  .runtime-domain-view-header > div {
    flex: 1;
  }

  .runtime-domain-view-title {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .runtime-domain-view-title > span {
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
  }

  .runtime-domain-view-title h1 {
    overflow-wrap: anywhere;
  }

  .runtime-domain-detail-view {
    margin-top: 24px;
  }

  .runtime-domain-detail-view > header h4,
  .runtime-domain-view-entries > h4 {
    margin: 0;
    font-size: var(--opl-text-sm);
    font-weight: var(--opl-weight-semibold);
  }

  .runtime-domain-detail-view > header h4 {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .runtime-domain-detail-view > nav,
  .runtime-domain-view-entry-list {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .runtime-domain-detail-view > nav button,
  .runtime-domain-view-entry-list > button {
    min-width: 0;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    border: 1px solid var(--opl-border);
    border-radius: 7px;
    background: var(--opl-canvas);
    color: var(--opl-text);
    overflow-wrap: anywhere;
    text-align: left;
  }

  .runtime-domain-detail-view > nav button[aria-selected="true"],
  .runtime-domain-detail-view > nav button:hover,
  .runtime-domain-view-entry-list > button:hover {
    border-color: var(--opl-border-heavy);
    background: var(--opl-hover);
  }

  .runtime-domain-detail-view > [role="tabpanel"] {
    min-width: 0;
    padding-top: 16px;
    border-top: 1px solid var(--opl-border);
  }

  .runtime-domain-detail-view > [role="tabpanel"] > p {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    color: var(--opl-muted);
  }

  .runtime-domain-detail-view > [role="tabpanel"] > button {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 12px;
    border: 1px solid var(--opl-border);
    border-radius: 7px;
    background: var(--opl-canvas);
    color: var(--opl-muted);
  }

  .runtime-domain-view-entries {
    grid-column: 1 / -1;
    padding-top: 12px;
    border-top: 1px solid var(--opl-border);
  }

  .runtime-scope-band {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(150px, 220px) minmax(150px, 240px) minmax(120px, 1fr);
    align-items: end;
    gap: var(--opl-space-4);
    margin-top: var(--opl-space-5);
    padding: 12px 0;
    border-block: 1px solid var(--opl-border);
  }

  .runtime-scope-band > strong {
    align-self: center;
    font-size: var(--opl-text-sm);
    font-weight: var(--opl-weight-semibold);
  }

  .runtime-scope-band label {
    min-width: 0;
    display: grid;
    gap: var(--opl-space-1);
  }

  .runtime-scope-band label > span,
  .runtime-loaded-at,
  .runtime-list-heading span,
  .runtime-work-identity > span,
  .runtime-work-status small,
  .runtime-work-progress p,
  .runtime-stage-popover li small,
  .runtime-work-usage dt,
  .runtime-work-time {
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
  }

  .runtime-scope-band select,
  .runtime-list-controls select {
    min-width: 0;
    height: var(--opl-control-md);
    padding: 0 28px 0 9px;
    border: 1px solid var(--opl-border);
    border-radius: var(--opl-radius-control);
    background: var(--opl-canvas);
    color: var(--opl-text);
  }

  .runtime-loaded-at {
    justify-self: end;
    align-self: center;
    white-space: nowrap;
  }

  .runtime-summary-band {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
    border-bottom: 1px solid var(--opl-border);
  }

  .runtime-summary-band > div {
    min-width: 0;
    padding: 14px 0;
  }

  .runtime-summary-band > div + div {
    padding-left: 20px;
    border-left: 1px solid var(--opl-border);
  }

  .runtime-summary-band dt {
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
  }

  .runtime-summary-band dd {
    margin: var(--opl-space-1) 0 0;
    font-size: var(--opl-text-lg);
    font-weight: var(--opl-weight-semibold);
  }

  .runtime-summary-band dd[data-tone="success"] { color: var(--opl-success); }
  .runtime-summary-band dd[data-tone="active"] { color: var(--opl-accent); }
  .runtime-summary-band dd[data-tone="attention"] { color: var(--opl-warning); }
  .runtime-summary-band dd[data-tone="muted"] { color: var(--opl-muted); }

  .runtime-recovery-band {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(220px, 1.1fr) minmax(240px, 1fr) minmax(220px, auto);
    align-items: center;
    gap: var(--opl-space-4);
    padding: 14px 0;
    border-bottom: 1px solid var(--opl-border);
  }

  .runtime-recovery-heading,
  .runtime-recovery-action,
  .runtime-recovery-confirmation {
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .runtime-recovery-heading {
    gap: 9px;
  }

  .runtime-recovery-heading > svg {
    flex: 0 0 auto;
    color: var(--opl-muted);
  }

  .runtime-recovery-band[data-status="attention"] .runtime-recovery-heading > svg,
  .runtime-recovery-band[data-status="blocked"] .runtime-recovery-heading > svg {
    color: var(--opl-warning);
  }

  .runtime-recovery-heading h2,
  .runtime-recovery-heading p,
  .runtime-recovery-action p {
    margin: 0;
  }

  .runtime-recovery-heading h2 {
    font-size: var(--opl-text-md);
    font-weight: var(--opl-weight-semibold);
  }

  .runtime-recovery-heading p,
  .runtime-recovery-band dt,
  .runtime-recovery-action > span,
  .runtime-recovery-action p {
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
    line-height: var(--opl-leading-normal);
  }

  .runtime-recovery-band dl {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
  }

  .runtime-recovery-band dd {
    margin: 3px 0 0;
    overflow-wrap: anywhere;
    font-size: var(--opl-text-xs);
    font-weight: var(--opl-weight-medium);
  }

  .runtime-recovery-action {
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 7px;
  }

  .runtime-recovery-action button,
  .runtime-recovery-confirmation button {
    min-height: var(--opl-control-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 10px;
    border: 1px solid var(--opl-border);
    border-radius: var(--opl-radius-control);
    background: var(--opl-canvas);
    color: var(--opl-text);
    font-size: var(--opl-text-sm);
  }

  .runtime-recovery-action button:hover:not(:disabled),
  .runtime-recovery-confirmation button:hover:not(:disabled) {
    background: var(--opl-hover);
  }

  .runtime-recovery-confirmation {
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 7px;
  }

  .runtime-recovery-confirmation > span {
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
  }

  .runtime-recovery-confirmation button.primary {
    border-color: var(--opl-text);
    background: var(--opl-text);
    color: var(--opl-canvas);
  }

  .runtime-recovery-action p {
    flex-basis: 100%;
    text-align: right;
  }

  .runtime-recovery-action p[data-tone="attention"] {
    color: var(--opl-warning);
  }

  .runtime-list-heading {
    justify-content: space-between;
    gap: var(--opl-space-4);
    margin-top: var(--opl-space-5);
  }

  .runtime-list-heading > div:first-child {
    gap: var(--opl-space-2);
    min-width: 0;
  }

  .runtime-list-heading h2 {
    margin: 0;
    font-size: var(--opl-text-lg);
    font-weight: var(--opl-weight-semibold);
  }

  .runtime-list-controls {
    gap: 8px;
  }

  .runtime-archive-button {
    min-height: var(--opl-control-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 10px;
    border: 1px solid var(--opl-border);
    border-radius: var(--opl-radius-control);
    background: var(--opl-canvas);
    color: var(--opl-text);
  }

  .runtime-archive-button:hover,
  .runtime-archive-button[aria-pressed="true"] {
    background: var(--opl-hover);
  }

  .runtime-overview-error,
  .runtime-overview-empty {
    margin: 22px 0 0;
    padding: 20px 0;
    color: var(--opl-muted);
    text-align: center;
  }

  .runtime-overview-error {
    color: var(--opl-danger);
  }

  .runtime-work-list {
    display: grid;
    gap: var(--opl-space-3);
    margin-top: var(--opl-space-3);
  }

  .runtime-work-row {
    min-width: 0;
    position: relative;
    display: grid;
    grid-template-columns: minmax(190px, 1.15fr) minmax(92px, .55fr) minmax(260px, 1.5fr) minmax(150px, .8fr);
    align-items: center;
    gap: var(--opl-space-4);
    padding: var(--opl-space-4);
    border: 1px solid var(--opl-border);
    border-radius: var(--opl-radius-surface);
    background: var(--opl-surface-elevated);
  }

  .runtime-work-row:hover {
    border-color: var(--opl-border-heavy);
  }

  .runtime-work-row[data-selected="true"] {
    border-color: var(--opl-accent);
  }

  .runtime-work-identity,
  .runtime-work-progress,
  .runtime-work-usage {
    min-width: 0;
  }

  .runtime-work-identity > strong,
  .runtime-work-identity > button > strong {
    display: block;
    color: var(--opl-muted);
    font-size: var(--opl-text-xs);
    font-weight: var(--opl-weight-medium);
  }

  .runtime-work-identity > button {
    display: grid;
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .runtime-work-identity > button:hover h3,
  .runtime-work-identity > button:focus-visible h3 {
    color: var(--opl-accent);
  }

  .runtime-work-identity h3 {
    margin: var(--opl-space-1) 0 var(--opl-space-2);
    overflow-wrap: anywhere;
    font-size: var(--opl-text-md);
    line-height: var(--opl-leading-normal);
    font-weight: var(--opl-weight-semibold);
    letter-spacing: 0;
  }

  .runtime-work-identity > span,
  .runtime-work-identity > button > span {
    gap: 5px;
  }

  .runtime-work-status {
    min-width: 0;
    display: grid;
    gap: var(--opl-space-1);
    justify-items: start;
  }

  .runtime-work-status > span {
    display: inline-flex;
    max-width: 100%;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--opl-surface-secondary);
    color: var(--opl-muted);
    overflow-wrap: anywhere;
    font-size: var(--opl-text-sm);
  }

  .runtime-work-row[data-status="running"] .runtime-work-status > span {
    background: color-mix(in oklab, var(--opl-accent) 13%, transparent);
    color: var(--opl-accent);
  }

  .runtime-work-row[data-status="attention"] .runtime-work-status > span {
    background: var(--opl-warning-soft);
    color: var(--opl-warning);
  }

  .runtime-stage-button {
    width: 100%;
    min-height: var(--opl-control-sm);
    justify-content: space-between;
    gap: 9px;
    padding: 0 8px;
    border: 1px solid var(--opl-border);
    border-radius: var(--opl-radius-control);
    background: var(--opl-canvas);
    color: var(--opl-text);
    text-align: left;
  }

  .runtime-stage-button > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--opl-text-sm);
  }

  .runtime-stage-button[aria-expanded="true"] svg {
    transform: rotate(180deg);
  }

  .runtime-work-progress p {
    margin: var(--opl-space-2) 0 0;
    font-size: var(--opl-text-sm);
    line-height: var(--opl-leading-normal);
    overflow-wrap: anywhere;
  }

  .runtime-work-progress p strong {
    color: var(--opl-text);
    font-weight: var(--opl-weight-medium);
  }

  .runtime-stage-popover {
    position: absolute;
    z-index: 12;
    top: calc(100% - 8px);
    right: 152px;
    width: min(360px, calc(100% - 28px));
    max-height: 320px;
    overflow: auto;
    padding: var(--opl-space-3);
    border: 1px solid var(--opl-border-heavy);
    border-radius: var(--opl-radius-surface);
    background: var(--opl-canvas);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
  }

  .runtime-stage-popover > header {
    justify-content: space-between;
    gap: 12px;
  }

  .runtime-stage-popover > header button {
    flex-basis: 26px;
    width: 26px;
    height: 26px;
  }

  .runtime-stage-popover ol {
    display: grid;
    gap: 0;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .runtime-stage-popover li {
    min-width: 0;
    display: grid;
    grid-template-columns: 14px minmax(0, 1fr);
    gap: 7px;
    padding: 7px 0;
  }

  .runtime-stage-popover li > span {
    width: 8px;
    height: 8px;
    margin-top: 4px;
    border: 2px solid var(--opl-border-heavy);
    border-radius: 50%;
  }

  .runtime-stage-popover li[data-state="completed"] > span {
    border-color: var(--opl-success);
    background: var(--opl-success);
  }

  .runtime-stage-popover li[data-state="running"] > span {
    border-color: var(--opl-accent);
    background: var(--opl-accent);
  }

  .runtime-stage-popover li div {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .runtime-stage-popover li strong {
    overflow-wrap: anywhere;
    font-size: var(--opl-text-sm);
    font-weight: var(--opl-weight-medium);
  }

  .runtime-work-usage {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .runtime-work-usage > div:not(.runtime-work-time) {
    min-width: 0;
    padding-left: 8px;
    border-left: 1px solid var(--opl-border);
  }

  .runtime-work-usage dt,
  .runtime-work-usage dd {
    overflow-wrap: anywhere;
  }

  .runtime-work-usage dd {
    margin: var(--opl-space-1) 0 0;
    font-size: var(--opl-text-sm);
    font-weight: var(--opl-weight-medium);
  }

  .runtime-work-time {
    grid-column: 1 / -1;
    gap: 5px;
  }


  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

`;
