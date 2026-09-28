import { ChevronLeft } from "lucide-react";
import { DshPreviewAdapter } from "./DshPreviewAdapter";
import type { EcosystemWorkspaceBridge } from "./ecosystemWorkspaceProvider";

export type EcosystemFilePreviewProps = EcosystemWorkspaceBridge & {
  relativePath: string;
  locale: "zh" | "en";
  onClose(): void;
};

/** Canonical workspace bridge for the supported DSH preview primitives. */
export function EcosystemFilePreview(props: EcosystemFilePreviewProps) {
  return <section className="opl-ecosystem-file-preview" data-testid="opl-ecosystem-file-preview" style={{ minWidth: 0, display: "flex", flexDirection: "column", height: "min(65vh, 740px)", minHeight: 340 }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={props.relativePath}>{props.relativePath.split("/").at(-1)}</strong>
      <button type="button" aria-label={props.locale === "zh" ? "返回文件列表" : "Back to files"} title={props.locale === "zh" ? "返回文件列表" : "Back to files"} onClick={props.onClose}><ChevronLeft aria-hidden="true" size={18} /></button>
    </header>
    <DshPreviewAdapter key={`${props.threadId}:${props.relativePath}`} {...props} />
  </section>;
}
