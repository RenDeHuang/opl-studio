import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MarkdownText, type MarkdownLabels } from "../../vendor/deepseek-harness/packages/client/ui-primitives/src/index";
import type { EcosystemWorkspaceBridge } from "./ecosystemWorkspaceProvider";

type PreviewProps = EcosystemWorkspaceBridge & { relativePath: string; locale: "zh" | "en" };
type LoadedFile = { data: Uint8Array; sizeBytes: number };

const textExtensions = new Set([
  "md", "markdown", "html", "htm", "txt", "text", "log", "json", "yaml", "yml", "toml",
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "scss", "less", "py", "go", "rs", "java",
  "kt", "swift", "c", "cpp", "h", "hpp", "sh", "bash", "xml"
]);
const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"]);

function extensionOf(value: string): string {
  const name = value.replaceAll("\\", "/").split("/").at(-1) ?? value;
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

async function readComplete(bridge: EcosystemWorkspaceBridge, relativePath: string, signal: AbortSignal): Promise<LoadedFile> {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let sizeBytes = 0;
  while (true) {
    signal.throwIfAborted();
    const result = await bridge.readBytes({ threadId: bridge.threadId, relativePath, offset, length: 512 * 1024 });
    signal.throwIfAborted();
    const raw = atob(result.data);
    if (result.offset !== offset || raw.length > 512 * 1024 || (!raw.length && !result.eof)) throw new Error("Invalid workspace byte response");
    const bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
    chunks.push(bytes);
    sizeBytes = result.sizeBytes;
    offset += bytes.length;
    if (result.eof) break;
  }
  const data = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) { data.set(chunk, cursor); cursor += chunk.length; }
  return { data, sizeBytes };
}

function textFor(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

const markdownLabels: MarkdownLabels = {
  code: {
    copyLabel: "Copy",
    copiedLabel: "Copied",
    toolbarLabels: { codeLabel: "Code block", wrapLabel: "Wrap lines", unwrapLabel: "Unwrap lines" }
  },
  footnotes: "Footnotes"
};

/**
 * Temporary OPL workspace adapter. The official DSH documentpreview client is
 * carried separately and is activated only when the full Remote/Resource/
 * Sidebar runtime is present; this adapter keeps the current file panel usable
 * without fabricating those DSH services.
 */
export function DshPreviewAdapter(props: PreviewProps): ReactNode {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; file?: LoadedFile }>({ status: "loading" });
  const [imageUrl, setImageUrl] = useState<string>();
  const extension = extensionOf(props.relativePath);
  const isText = textExtensions.has(extension);
  const isImage = imageExtensions.has(extension);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void readComplete(props, props.relativePath, controller.signal).then(
      file => { if (!controller.signal.aborted) setState({ status: "ready", file }); },
      () => { if (!controller.signal.aborted) setState({ status: "error" }); },
    );
    return () => controller.abort();
  }, [props.threadId, props.relativePath]);

  const text = useMemo(() => state.status === "ready" && state.file ? textFor(state.file.data) : "", [state]);

  useEffect(() => {
    if (state.status !== "ready" || !state.file || !isImage) { setImageUrl(undefined); return; }
    const mime = extension === "svg" ? "image/svg+xml" : `image/${extension === "jpg" ? "jpeg" : extension}`;
    const url = URL.createObjectURL(new Blob([state.file.data], { type: mime }));
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [extension, isImage, state]);

  if (state.status === "loading") return <p role="status">{props.locale === "zh" ? "正在加载文件..." : "Loading file..."}</p>;
  if (state.status === "error" || !state.file) return <p role="alert">{props.locale === "zh" ? "无法读取此文件。" : "This file could not be read."}</p>;
  if (isImage && imageUrl) return <img src={imageUrl} alt={props.relativePath} style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", alignSelf: "center" }} />;
  if (extension === "md" || extension === "markdown") return <div style={{ overflow: "auto" }}><MarkdownText text={text} labels={markdownLabels} /></div>;
  if (isText) return <pre style={{ margin: 0, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</pre>;
  return <p role="status">{props.locale === "zh" ? "官方 DSH 文档预览运行时尚未在当前文件面板启用；请使用系统应用打开。" : "The official DSH document preview runtime is not enabled in this file panel yet; use the system app to open this file."}</p>;
}
