window.__ModuleLoader__.load({
	id: "dsh-plugin-pdf-annotator",
	factory: (require) => {
		var __dshRequire = require;
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  VIEWER_ID: () => VIEWER_ID,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/action.css
var action_default = "/* Toolbar button in the document header, sized like the preview's own tools. */\n.pdfa-tool {\n  display: inline-flex;\n  flex: none;\n  gap: 4px;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  min-width: 28px;\n  height: 28px;\n  padding: 0 6px;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-size: 12px;\n  line-height: 1;\n  background: transparent;\n  border: none;\n  border-radius: var(--dsw-radius-sm, 8px);\n  cursor: pointer;\n}\n\n.pdfa-tool svg {\n  width: 15px;\n  height: 15px;\n}\n\n.pdfa-tool:hover,\n.pdfa-tool[aria-pressed='true'] {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.pdfa-tool-count {\n  box-sizing: border-box;\n  min-width: 16px;\n  height: 16px;\n  padding: 0 4px;\n  color: var(--dsw-alias-label-primary-foreground);\n  font-size: 11px;\n  font-weight: 600;\n  line-height: 16px;\n  text-align: center;\n  background: var(--dsw-alias-button-primary-fill);\n  border-radius: 8px;\n  corner-shape: round;\n}\n\n.pdfa-loading {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  min-height: 120px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  line-height: 1.5;\n}\n";

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var common = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true
};
function CommentIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...common, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8.5L5.5 14v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 6.5h6M5 8.75h4" })
  ] });
}

// src/client/annotations/shared.ts
var import_react = require("react");

// src/client/model.ts
function sortByPosition(annotations) {
  const top = (a) => a.rects[0]?.y ?? 0;
  const left = (a) => a.rects[0]?.x ?? 0;
  return [...annotations].sort((a, b) => a.page - b.page || top(a) - top(b) || left(a) - left(b) || a.createdAt - b.createdAt);
}
function sameVersion(a, b) {
  return a.id === b.id && a.comment === b.comment;
}

// src/client/annotations/persistence.ts
var STORAGE_PREFIX = "dsh-plugin-pdf-annotator:v1:";
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isRect(value) {
  if (typeof value !== "object" || value === null) return false;
  const rect = value;
  return finite(rect.page) && finite(rect.x) && finite(rect.y) && finite(rect.w) && finite(rect.h);
}
function isAnnotation(value) {
  if (typeof value !== "object" || value === null) return false;
  const item = value;
  return typeof item.id === "string" && finite(item.page) && typeof item.quote === "string" && typeof item.comment === "string" && finite(item.createdAt) && Array.isArray(item.rects) && item.rects.every(isRect);
}
function storagePersistence(access) {
  const storage = () => {
    const value = access();
    if (value === void 0) throw new Error("Storage unavailable");
    return value;
  };
  return {
    load(key) {
      const raw = storage().getItem(STORAGE_PREFIX + key);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isAnnotation)) throw new Error("Invalid saved annotations");
      return sortByPosition(parsed);
    },
    save(key, annotations) {
      if (annotations.length === 0) storage().removeItem(STORAGE_PREFIX + key);
      else storage().setItem(STORAGE_PREFIX + key, JSON.stringify(annotations));
    }
  };
}

// src/client/annotations/store.ts
function mergeById(earlier, later) {
  return [...new Map([...earlier, ...later].map((item) => [item.id, item])).values()];
}
function createAnnotationStore(access = () => globalThis.localStorage) {
  const persistence = storagePersistence(access);
  const entries = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  const unread = /* @__PURE__ */ new Set();
  const dirty = /* @__PURE__ */ new Set();
  function read(key) {
    let entry = entries.get(key);
    if (entry === void 0) {
      try {
        entry = { annotations: persistence.load(key), panelOpen: false };
      } catch {
        unread.add(key);
        entry = { annotations: [], panelOpen: false, storageError: "read" };
      }
      entries.set(key, entry);
    }
    return entry;
  }
  function publish(key, entry) {
    entries.set(key, entry);
    for (const listener of listeners.get(key) ?? []) listener();
  }
  function sync(key, entry) {
    let annotations = entry.annotations;
    if (unread.has(key)) {
      try {
        annotations = sortByPosition(mergeById(persistence.load(key), annotations));
        unread.delete(key);
      } catch {
        return { ...entry, storageError: "read" };
      }
    }
    if (dirty.has(key)) {
      try {
        persistence.save(key, annotations);
        dirty.delete(key);
      } catch {
        return { ...entry, annotations, storageError: "write" };
      }
    }
    return { ...entry, annotations, storageError: void 0 };
  }
  function change(key, annotations) {
    dirty.add(key);
    publish(key, sync(key, { ...read(key), annotations: sortByPosition(annotations) }));
  }
  return {
    subscribe(key, listener) {
      let set = listeners.get(key);
      if (set === void 0) listeners.set(key, set = /* @__PURE__ */ new Set());
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    get: read,
    add(key, annotation) {
      change(key, [...read(key).annotations, annotation]);
    },
    update(key, id, patch) {
      change(key, read(key).annotations.map((item) => item.id === id ? { ...item, ...patch } : item));
    },
    remove(key, id) {
      change(key, read(key).annotations.filter((item) => item.id !== id));
    },
    clear(key) {
      const removed = read(key).annotations;
      change(key, []);
      return removed;
    },
    restore(key, annotations) {
      change(key, mergeById(annotations, read(key).annotations));
    },
    acknowledge(key, sent) {
      change(key, read(key).annotations.filter((item) => !sent.some((done) => sameVersion(done, item))));
    },
    setPanel(key, open) {
      const entry = read(key);
      if (entry.panelOpen !== open) publish(key, { ...entry, panelOpen: open });
    },
    setDelivery(key, delivery) {
      publish(key, { ...read(key), delivery });
    },
    retryPersistence(key) {
      publish(key, sync(key, read(key)));
    }
  };
}

// src/client/annotations/shared.ts
var annotationStore = createAnnotationStore();
function useEntry(key, select) {
  return (0, import_react.useSyncExternalStore)(
    (listener) => annotationStore.subscribe(key, listener),
    () => select(annotationStore.get(key))
  );
}

// src/client/AnnotationsAction.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function AnnotationsAction({ useTabInfo, t }) {
  const { tab } = useTabInfo();
  const count = useEntry(tab.contentId, (entry) => entry.annotations.length);
  const open = useEntry(tab.contentId, (entry) => entry.panelOpen);
  const label = t("action.label");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      className: "pdfa-tool",
      "aria-pressed": open,
      "aria-label": label,
      title: label,
      "data-pdfa-action": true,
      onClick: () => {
        annotationStore.setPanel(tab.contentId, !open);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CommentIcon, {}),
        count > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pdfa-tool-count", children: count })
      ]
    }
  );
}

// src/client/chat/delivery.ts
var attempts = 0;
async function sendAnnotationMessage(session, text) {
  if (session === void 0) return { ok: false };
  const submission = session.beginSubmission({ mode: "queue", text, attachments: [] });
  try {
    const result = await session.prompt([{ type: "text", text }], "queue", void 0, submission.requestId);
    if (!result.ok) submission.abandon();
    return result;
  } catch (error) {
    submission.abandon();
    throw error;
  }
}
function isAccepted(result) {
  return result.ok && result.value?.accepted === true;
}
async function admitted(send, text) {
  try {
    return isAccepted(await send(text));
  } catch {
    return false;
  }
}
async function deliverAnnotations(store, key, text, send) {
  const { annotations, delivery } = store.get(key);
  if (delivery?.kind === "sending" || annotations.length === 0) return;
  const attempt = { count: annotations.length, seq: ++attempts };
  store.setDelivery(key, { ...attempt, kind: "sending", at: Date.now() });
  const accepted = await admitted(send, text);
  if (accepted) {
    store.acknowledge(key, annotations);
    if (store.get(key).annotations.length === 0) store.setPanel(key, false);
  }
  store.setDelivery(key, { ...attempt, kind: accepted ? "accepted" : "failed", at: Date.now() });
}

// src/client/LazyViewer.tsx
var import_react2 = require("react");

// src/client/chat/composer.ts
function composerBusy(phase) {
  return phase === "adjudicating" || phase === "submitting" || phase === "sending";
}
function separatorAfter(draft) {
  if (draft.trim() === "" || draft.endsWith("\n\n")) return "";
  return draft.endsWith("\n") ? "\n" : "\n\n";
}
function appendToComposer(input, composer, text) {
  const { draftRev } = input.captureInsertion();
  if (draftRev !== composer.draftRev) return false;
  const end = composer.draft.length;
  return input.insertText(separatorAfter(composer.draft) + text + "\n", { start: end, end, draftRev });
}

// src/client/chat/format.ts
var FILE_ADDRESS = /^dsh-resource:\/\/file\/session\/[^/]+\/(.+)$/;
function pathOfAddress(address) {
  const match = FILE_ADDRESS.exec(address);
  if (match?.[1] === void 0) return void 0;
  try {
    return match[1].split("/").map(decodeURIComponent).join("/");
  } catch {
    return void 0;
  }
}
function mentionOf(address) {
  const path = pathOfAddress(address);
  if (path === void 0) return "`PDF`";
  if (/["\u0000-\u001f]/.test(path)) return `\`${path.replace(/`/g, "")}\``;
  return /\s/.test(path) ? `@"${path}"` : `@${path}`;
}
function formatMessage(t, address, annotations) {
  const lines = [t("message.header", { file: mentionOf(address), count: annotations.length })];
  annotations.forEach((annotation, index) => {
    lines.push("", t("message.item", { n: index + 1, page: annotation.page }));
    for (const line of annotation.quote.split("\n")) lines.push(`> ${line}`);
    const comment = annotation.comment.trim();
    if (comment !== "") lines.push(t("message.comment", { comment }));
  });
  return lines.join("\n");
}

// src/client/chat/actions.ts
function annotationsBusy(entry, phase) {
  return composerBusy(phase) || entry.delivery?.kind === "sending";
}
function createChatActions(store) {
  return {
    busy(file, phase) {
      return annotationsBusy(store.get(file.key), phase);
    },
    addToChat(file, t, input, composer) {
      const entry = store.get(file.key);
      if (entry.annotations.length === 0) return { kind: "empty" };
      if (annotationsBusy(entry, composer.phase)) return { kind: "busy" };
      if (!appendToComposer(input, composer, formatMessage(t, file.address, entry.annotations))) return { kind: "refused" };
      const removed = store.clear(file.key);
      store.setPanel(file.key, false);
      return { kind: "added", removed };
    },
    sendNow(file, t, phase, send) {
      const entry = store.get(file.key);
      if (entry.annotations.length === 0) return "empty";
      if (annotationsBusy(entry, phase)) return "busy";
      void deliverAnnotations(store, file.key, formatMessage(t, file.address, entry.annotations), send);
      return "started";
    }
  };
}

// src/client/style.ts
var PLUGIN_ID = "dsh-plugin-pdf-annotator";
function injectStyle(name2, css) {
  if (typeof document === "undefined") return;
  const tagId = `${PLUGIN_ID}/${name2}`;
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(tagId)}]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PLUGIN_ID;
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}

// src/client/LazyViewer.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var LoadedViewer = (0, import_react2.lazy)(async () => {
  const chunk = await __dshRequire.async("./client.viewer.js");
  return { default: chunk.PdfAnnotatorViewer };
});
var kit = { store: annotationStore, useEntry, injectStyle, ...createChatActions(annotationStore) };
function LazyViewer(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react2.Suspense, { fallback: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "pdfa-loading", role: "status", children: props.t("viewer.loading") }), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(LoadedViewer, { ...props, kit }) });
}

// src/client/locales.ts
var NS = "pdfAnnotator";
var zh = {
  "viewer.title": "PDF 批注",
  "viewer.loading": "正在打开 PDF…",
  "viewer.failed": "无法显示 PDF：{message}",
  "viewer.password": "此 PDF 需要密码，暂不支持",
  "viewer.unsupported": "PDF 批注需要完整的文件内容",
  "viewer.retry": "重试",
  "viewer.page": "第 {page} 页",
  "selection.comment": "添加批注",
  "selection.quote": "仅引用",
  "editor.placeholder": "写下批注，例如：把这句改写得更简洁",
  "editor.hint": "Enter 保存 · Shift+Enter 换行 · Esc 取消",
  "editor.save": "保存",
  "editor.cancel": "取消",
  "editor.delete": "删除",
  "mark.quoteOnly": "（仅引用，无批注）",
  "dock.toggle": "批注 {count}",
  "dock.insert": "插入输入框",
  "dock.insertHint": "把全部批注作为一条消息放进对话输入框，你可以补充要求后再发送",
  "dock.zoomOut": "缩小",
  "dock.zoomIn": "放大",
  "dock.zoomFit": "适应宽度",
  "panel.title": "批注（{count}）",
  "panel.empty": "在 PDF 中选中文字，点击「添加批注」。",
  "panel.locate": "定位",
  "panel.edit": "编辑",
  "panel.delete": "删除",
  "panel.clear": "清空",
  "panel.send": "立即发送",
  "panel.sendHint": "立即发送仅提交批注。要连同输入框里的要求一起发送，请先插入输入框。",
  "panel.close": "收起",
  "notice.inserted": "已把 {count} 条批注放进输入框",
  "notice.sent": "会话已接收 {count} 条批注",
  "notice.sending": "正在提交 {count} 条批注，等待接收确认…",
  "notice.sendFailed": "未能确认发送，批注已保留。请先查看对话，确认未送达后再重试。",
  "notice.cleared": "已清空 {count} 条批注",
  "notice.busy": "输入框正忙，请稍后再试",
  "notice.failed": "没能写入输入框，请点一下输入框后重试",
  "notice.undo": "恢复批注",
  "storage.readFailed": "无法读取本地批注。当前修改暂存于内存，请重试；关闭或刷新前请先保留批注内容。",
  "storage.writeFailed": "批注更改尚未保存到本地。关闭或刷新后可能丢失或恢复旧内容，请重试保存。",
  "storage.retry": "重试保存",
  "action.label": "批注列表",
  "message.header": "请处理我在 {file} 中的 {count} 条批注：",
  "message.item": "【{n}】第 {page} 页",
  "message.comment": "批注：{comment}"
};
var en = {
  "viewer.title": "PDF (annotate)",
  "viewer.loading": "Opening PDF…",
  "viewer.failed": "Cannot display PDF: {message}",
  "viewer.password": "This PDF requires a password, which is not supported yet.",
  "viewer.unsupported": "PDF annotation needs the complete file contents.",
  "viewer.retry": "Retry",
  "viewer.page": "Page {page}",
  "selection.comment": "Comment",
  "selection.quote": "Quote",
  "editor.placeholder": "Write a comment, e.g. “make this sentence more concise”",
  "editor.hint": "Enter to save · Shift+Enter for a new line · Esc to cancel",
  "editor.save": "Save",
  "editor.cancel": "Cancel",
  "editor.delete": "Delete",
  "mark.quoteOnly": "(quote only, no comment)",
  "dock.toggle": "Comments {count}",
  "dock.insert": "Add to chat",
  "dock.insertHint": "Put every comment into the chat input as one message; add instructions, then send",
  "dock.zoomOut": "Zoom out",
  "dock.zoomIn": "Zoom in",
  "dock.zoomFit": "Fit width",
  "panel.title": "Comments ({count})",
  "panel.empty": "Select text in the PDF, then choose “Comment”.",
  "panel.locate": "Show",
  "panel.edit": "Edit",
  "panel.delete": "Delete",
  "panel.clear": "Clear",
  "panel.send": "Send now",
  "panel.sendHint": "Send now submits only comments. To include your draft instructions, choose Add to chat first.",
  "panel.close": "Collapse",
  "notice.inserted": "Comments added to the chat input ({count})",
  "notice.sent": "Conversation accepted the comments ({count})",
  "notice.sending": "Submitting comments ({count}); waiting for confirmation…",
  "notice.sendFailed": "Delivery was not confirmed. Comments are retained. Check the conversation before retrying.",
  "notice.cleared": "Comments cleared ({count})",
  "notice.busy": "The chat input is busy; try again in a moment",
  "notice.failed": "Could not write to the chat input; click it once and retry",
  "notice.undo": "Restore comments",
  "storage.readFailed": "Saved comments could not be read. Current changes are in memory only. Retry and keep a copy before closing or reloading.",
  "storage.writeFailed": "Comment changes have not been saved. Closing or reloading may lose changes or restore older content. Retry saving.",
  "storage.retry": "Retry saving",
  "action.label": "Comments",
  "message.header": "Please address my comments on {file} ({count} in total):",
  "message.item": "[{n}] Page {page}",
  "message.comment": "Comment: {comment}"
};
var dictionaries = { zh, en };

// src/client/index.ts
var VIEWER_ID = "dsh-plugin-pdf-annotator/viewer";
var name = "pdf-annotator";
var inject = ["slots", "locale", "documentPreviews", "sessions"];
function apply(ctx) {
  injectStyle("action", action_default);
  ctx.effect(() => ctx.locale.register(NS, dictionaries), "pdf-annotator: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.documentPreviews.register({
    id: VIEWER_ID,
    extensions: ["pdf"],
    binaryExtensions: ["pdf"],
    priority: "extension",
    title: () => t("viewer.title"),
    loading: "bytes-complete",
    wrap: false
  }), "pdf-annotator: renderer");
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
    name: "sidebar.right.tab.document",
    key: VIEWER_ID,
    locale: NS,
    // Each Session's viewer sends "Send now" batches through that Session.
    inject: (sessionId) => ({
      sendAnnotations: (text) => sendAnnotationMessage(ctx.sessions.binding(sessionId)?.session, text)
    })
  }, LazyViewer)), "pdf-annotator: body");
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document.action", () => ctx.slots.register({
    name: "sidebar.right.tab.document.action",
    key: VIEWER_ID,
    locale: NS
  }, AnnotationsAction)), "pdf-annotator: toolbar");
}

		return module.exports;
	}
});
