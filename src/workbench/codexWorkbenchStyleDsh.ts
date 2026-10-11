export const codexWorkbenchStyleDsh = `  .opl-studio-dsh-root button[class*="newSession"] {
    height: 32px;
    justify-content: flex-start;
    gap: 9px;
    margin: 0 2px 8px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--opl-text);
    font-size: var(--opl-text-md);
    font-weight: var(--opl-weight-regular);
    line-height: 20px;
  }

  .opl-studio-dsh-root button[class*="newSession"]:hover {
    background: var(--opl-hover);
  }

  .opl-studio-dsh-root [class*="collapsed"] button[class*="newSession"] {
    width: 36px;
    height: 36px;
    justify-content: center;
    gap: 0;
    margin: 0 0 12px;
    padding: 0;
  }

  .opl-primary-nav[data-wide="false"] {
    width: 36px;
    margin: 0 0 12px;
  }

  .opl-primary-nav[data-wide="false"] button {
    width: 36px;
    height: 36px;
    justify-content: center;
    gap: 0;
    padding: 0;
    border-color: transparent;
    background: transparent;
  }

  .opl-primary-nav[data-wide="false"] button:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }

  .opl-workspace-browser-seat {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .opl-workspace-browser-seat > div:first-child,
  .opl-workspace-browser-seat [role="tree"] {
    flex: none;
    min-height: auto;
  }

  .opl-workspace-browser-seat [role="tree"] {
    overflow: visible;
    scrollbar-gutter: auto;
  }

  .opl-recent-sessions {
    flex: none;
    min-width: 0;
    margin: 4px 0 6px;
    padding-right: var(--dsh-sidebar-inline-padding);
  }

  .opl-recent-sessions h2 {
    min-height: 36px;
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0 4px;
    color: var(--dsw-alias-label-tertiary);
    font-size: var(--opl-text-body);
    font-weight: var(--opl-weight-regular);
    line-height: 20px;
  }

`;
