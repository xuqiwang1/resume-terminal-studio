import crypto from "node:crypto";
import { createServer } from "node:http";
import { watch } from "node:fs";
import { chmod, mkdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import runtimeModule from "./core/runtime.cjs";
import resumeEngine from "./bin/resume-engine.cjs";
import defaultResumeModule from "./defaultResume.cjs";
import atomicFileModule from "./core/atomicFile.cjs";
import presentationMergeModule from "./core/presentationMerge.cjs";
import resumeCoreModule from "./core/resumeCore.cjs";
import {
  activeResumePath,
  activityLogPath,
  activityStatePath,
  ensureActiveResume,
  ensureWorkspace,
  historyDir,
  listResumeDocuments,
  listResumeArchives,
  migrateActiveResumeFile,
  openResumeDocument,
  readActiveResume,
  readContextState,
  readSelectionState,
  createNewResumeFromTemplate,
  createResumeArchive,
  AUTO_ARCHIVE_REASON,
  restoreResumeArchive,
  saveResumeDocument,
  terminalAgentPath,
  workspaceDir,
  writeContextState,
  writeSelectionState
} from "./fileStore.js";

const { pendingPatchPath } = resumeEngine;
const { initializeRuntime, getRuntime } = runtimeModule;
const { createDefaultResume } = defaultResumeModule;
const { writeFileAtomic, writeJsonAtomic } = atomicFileModule;
const { mergePresentationOnto } = presentationMergeModule;
const { detectPendingConflicts } = resumeCoreModule;

const DEFAULT_PORT = 4318;
const configuredPort = Number(process.env.RESUME_BRIDGE_PORT || DEFAULT_PORT);

// The bridge can write the user's resume, so it must never run unauthenticated.
// `npm run dev:bridge` sets no token, and the old behaviour was to accept every
// request in that case — any local process, or any web page that knows the port,
// could stage or accept a patch. A missing token is now generated instead of
// waived, and published through the discovery file so the CLI and the Vite dev
// proxy pick it up automatically.
let configuredToken = process.env.RESUME_BRIDGE_TOKEN || "";

function ensureBridgeToken() {
  if (!configuredToken) {
    configuredToken = crypto.randomBytes(32).toString("hex");
    process.env.RESUME_BRIDGE_TOKEN = configuredToken;
  }
  return configuredToken;
}

export function getBridgeToken() {
  return configuredToken;
}

const resumeStreams = new Set();
const activityStreams = new Set();
const pendingStreams = new Set();
let activityOffset = 0;
let startupPromise = null;
let watchersAttached = false;
let mutationQueue = Promise.resolve();
// Watchers, timers, and the broadcast debounce used to outlive the server, so
// `before-quit` had nothing it could actually shut down. stopBridgeServer()
// drains them.
const disposables = [];

const defaultResume = createDefaultResume();

const SECTION_LABELS = {
  name: "姓名",
  title: "职位标题",
  contact: "联系方式",
  summary: "个人总结",
  experience: "工作经历",
  projects: "项目经历",
  education: "教育经历",
  skills: "专业技能"
};

const sendJson = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
};

function constantTimeEquals(left, right) {
  const a = Buffer.from(String(left ?? ""), "utf8");
  const b = Buffer.from(String(right ?? ""), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// EventSource cannot set request headers, so these three endpoints — and only
// these — accept the token as a query parameter. Everything that can mutate the
// resume must present it as a header, keeping the credential out of referrers,
// proxy logs, and shell history.
const QUERY_TOKEN_PATHS = new Set([
  "/api/resume/stream",
  "/api/activity/stream",
  "/api/patch/stream"
]);

// `token` defaults to the configured credential, which startBridgeServer
// guarantees is non-empty. An empty token is still treated as "unconfigured" so
// the predicate stays honest about what it was asked to check.
export function isAuthorizedRequest(req, token = configuredToken) {
  if (!token) return true;
  const headerToken = req.headers?.["x-resume-studio-token"];
  if (typeof headerToken === "string" && constantTimeEquals(headerToken, token)) return true;
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (!QUERY_TOKEN_PATHS.has(url.pathname)) return false;
    return constantTimeEquals(url.searchParams.get("token"), token);
  } catch {
    return false;
  }
}

// A page on any website can POST to 127.0.0.1 even though CORS stops it reading
// the reply, and DNS rebinding can make a remote host resolve here. The token
// already blocks those, but rejecting foreign origins outright costs nothing and
// removes the credential as the only line of defence.
export function isAllowedOrigin(req) {
  const origin = req.headers?.origin;
  // Electron (file://) and non-browser clients such as the CLI send no origin.
  if (!origin || origin === "null" || origin === "file://") return true;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
  } catch {
    return false;
  }
}

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const writeLine = (res, payload) => {
  res.write(`${JSON.stringify(payload)}\n`);
};

// A dead socket throws on write. Inside a forEach that aborted the whole loop, so
// one closed tab stopped every other client from receiving the broadcast. The
// failed stream is dropped from the set instead.
const writeSse = (res, event, data) => {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
};

const broadcastSse = (streams, event, data) => {
  for (const res of [...streams]) {
    if (!writeSse(res, event, data)) streams.delete(res);
  }
};

// Proxies and OS-level idle timeouts close a silent SSE connection. A comment
// line every 25s keeps it open without emitting a spurious event.
const SSE_HEARTBEAT_MS = 25000;

const openSseStream = (req, res, streams, { onClose } = {}) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  streams.add(res);
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      streams.delete(res);
      return;
    }
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
      streams.delete(res);
    }
  }, SSE_HEARTBEAT_MS);
  heartbeat.unref?.();
  const cleanup = () => {
    clearInterval(heartbeat);
    streams.delete(res);
    onClose?.();
  };
  req.on("close", cleanup);
  res.on("error", cleanup);
};

const currentRuntime = () => getRuntime();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runSerialized(task) {
  const result = mutationQueue.then(task, task);
  mutationQueue = result.catch(() => {});
  return result;
}

function buildDocumentIdentity({ mode, fileName = "", historyFileName = "", title = "", activeResumePath: resumePath = activeResumePath }) {
  const normalizedMode = ["template", "file", "history"].includes(mode) ? mode : "template";
  const normalizedFileName = path.basename(String(fileName || ""));
  const normalizedHistoryFileName = path.basename(String(historyFileName || ""));
  return {
    documentId: `${normalizedMode}:${normalizedFileName || normalizedHistoryFileName || "active"}`,
    mode: normalizedMode,
    fileName: normalizedFileName,
    historyFileName: normalizedHistoryFileName,
    title: String(title || ""),
    activeResumePath: String(resumePath || activeResumePath)
  };
}

function sameDocumentBinding(left, right) {
  if (!left || !right) return false;
  return (
    left.documentId === right.documentId &&
    left.mode === right.mode &&
    left.fileName === right.fileName &&
    left.historyFileName === right.historyFileName &&
    left.activeResumePath === right.activeResumePath
  );
}

async function syncRuntimeDocument(documentPatch, { forceRevisionBump = false } = {}) {
  const currentContext = await readContextState();
  const nextDocument = buildDocumentIdentity({
    ...currentContext.document,
    ...documentPatch
  });
  const currentRevision = Number.isInteger(currentContext?.document?.revision)
    ? currentContext.document.revision
    : 0;
  // The revision is the server's optimistic-concurrency counter. Honouring a
  // client-supplied value let any caller pin it and defeat the staleness check
  // that protects pending patches, so the request's `revision` is now ignored:
  // it either bumps because the binding changed, or it stays put.
  const shouldBump = forceRevisionBump || !sameDocumentBinding(currentContext.document, nextDocument);
  const revision = shouldBump ? currentRevision + 1 : currentRevision;
  const context = await writeContextState({
    document: {
      ...nextDocument,
      revision
    }
  });
  const result = currentRuntime().core.hydrateActiveDocument(context.document);
  if (result?.clearedPendingPatch) {
    broadcastPending();
  }
  return { context, document: context.document, clearedPendingPatch: !!result?.clearedPendingPatch };
}

function resumesEqual(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

async function reconcileStartupDocumentBinding() {
  const context = await readContextState();
  const activeResume = await readActiveResume();
  const document = context.document || {};

  const bindTemplate = () =>
    syncRuntimeDocument(
      {
        mode: "template",
        fileName: "",
        historyFileName: "",
        title: `${activeResume.name || "Your Name"}-resume`,
        activeResumePath
      },
      { forceRevisionBump: true }
    );

  if (document.activeResumePath !== activeResumePath) {
    return bindTemplate();
  }

  if (document.mode === "file" && document.fileName) {
    try {
      const raw = await readFile(path.join(workspaceDir, path.basename(document.fileName)), "utf8");
      const parsed = JSON.parse(raw);
      if (!resumesEqual(parsed.resume, activeResume)) {
        return bindTemplate();
      }
      currentRuntime().core.hydrateActiveDocument(context.document);
      return { context, document: context.document, clearedPendingPatch: false };
    } catch {
      return bindTemplate();
    }
  }

  if (document.mode === "history" && document.historyFileName) {
    try {
      const raw = await readFile(path.join(historyDir, path.basename(document.historyFileName)), "utf8");
      const parsed = JSON.parse(raw);
      if (!resumesEqual(parsed.resume, activeResume)) {
        return bindTemplate();
      }
      currentRuntime().core.hydrateActiveDocument(context.document);
      return { context, document: context.document, clearedPendingPatch: false };
    } catch {
      return bindTemplate();
    }
  }

  if (document.mode === "template") {
    currentRuntime().core.hydrateActiveDocument(context.document);
    return { context, document: context.document, clearedPendingPatch: false };
  }

  return bindTemplate();
}

// Reports an already-staged pending patch over NDJSON. Staging itself happens
// inside the mutation queue before any header is written, so by the time this
// runs nothing here can fail in a way that needs an HTTP status code.
// This never touches active-resume.json — the user must accept it in the workbench.
const streamStagedPatch = (res, patch, { pending }) => {
  const sectionId = patch.sectionId;
  const targetLabel = SECTION_LABELS[sectionId] || sectionId;

  writeLine(res, { type: "focus", payload: { sectionId } });
  writeLine(res, {
    type: "activity",
    payload: { label: "Patch", state: "Pending", text: `${targetLabel}已生成待确认改动。`, sectionId }
  });
  writeLine(res, { type: "patch", payload: { ...pending, before: pending.before } });
  writeLine(res, { type: "pending", payload: pending });
  broadcastPending();

  writeLine(res, {
    type: "activity",
    payload: { label: "Result", state: "Review", text: `${targetLabel}等待用户接受。`, done: true }
  });
  writeLine(res, { type: "done", payload: { ok: true } });
  res.end();
};

// 健壮读取：直接读 active-resume.json（不经过 ensureWorkspace，避免写风暴）。
// AI 分块写 / 原子写时可能读到半截文件，JSON.parse 失败则短延迟重试。
const readActiveResumeRobust = async (retries = 5, delayMs = 30) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const raw = await readFile(activeResumePath, "utf8");
      if (raw.trim()) {
        return JSON.parse(raw);
      }
    } catch {
      // 读到半截 / 文件正在被 rename 覆盖，稍后重试
    }
    if (attempt < retries) await sleep(delayMs);
  }
  return null;
};

let lastBroadcastSnapshot = null;
let broadcastTimer = null;

const doBroadcastResume = async () => {
  const resume = await readActiveResumeRobust();
  if (!resume) return; // 始终拿不到合法 JSON，放弃本轮，等下次 watch / 轮询补发
  try {
    currentRuntime().core.hydrateResume(resume);
  } catch {}
  const snapshot = JSON.stringify(resume);
  if (snapshot === lastBroadcastSnapshot) return; // 内容没变，不重复推送
  lastBroadcastSnapshot = snapshot;
  broadcastSse(resumeStreams, "resume", { resume });
};

// 防抖：把 AI 的多次连续写合并成一次广播
const broadcastResume = async () => {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    doBroadcastResume().catch(() => {});
  }, 80);
};

// 推送当前 pending patch（待确认草稿）状态给前端。
// pending 为 null 表示没有待确认项（已被 confirm / reject 清空）。
// Pending patches travel with the conflict list attached so the review UI can warn
// before the user clicks accept. This is computed against the runtime resume, which
// may lag the workbench's unsaved styling — /api/patch/confirm re-checks against the
// client's own copy and is the authoritative gate.
// Read-only: computes the payload without mutating runtime state, so a GET can
// never change what the next confirm sees. Callers that intend to re-bind the
// runtime to disk call syncPendingFromDisk() explicitly.
const pendingPayload = () => {
  const { core, persistence } = currentRuntime();
  const pending = persistence.loadPendingPatch();
  if (!pending) return { pending: null, conflicts: [] };
  return { pending, conflicts: detectPendingConflicts(pending, core.getResume()) };
};

const syncPendingFromDisk = () => {
  const { core, persistence } = currentRuntime();
  core.hydratePendingPatch(persistence.loadPendingPatch());
};

const broadcastPending = () => {
  broadcastSse(pendingStreams, "pending", pendingPayload());
};

const hydrateRuntimeDocumentFromContext = async () => {
  const context = await readContextState();
  return currentRuntime().core.hydrateActiveDocument(context.document);
};

const readActivityState = async () => {
  try {
    const raw = await readFile(activityStatePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const broadcastActivityChunk = async () => {
  try {
    const raw = await readFile(activityLogPath, "utf8");
    const nextOffset = raw.length;
    const chunk = raw.slice(activityOffset);
    activityOffset = nextOffset;
    const state = await readActivityState();
    if (!chunk.trim()) return;
    // A torn final line used to throw and discard the whole chunk, including the
    // well-formed events ahead of it. Unparseable lines are skipped individually.
    const events = [];
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // Skip this event; the next chunk will carry complete lines.
      }
    }
    for (const event of events) {
      broadcastSse(activityStreams, "activity", { event, state });
    }
  } catch {}
};

const server = createServer(async (req, res) => {
  if (!isAllowedOrigin(req)) {
    return sendJson(res, 403, { error: "Forbidden origin" });
  }
  if (!isAuthorizedRequest(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const requestPath = new URL(req.url || "/", "http://127.0.0.1").pathname;

  if (req.method === "GET" && requestPath === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      session: currentRuntime().activeSession,
      workspaceDir,
      activeResumePath,
      terminalAgentPath,
      activityLogPath
    });
  }

  if (req.method === "GET" && requestPath === "/api/resume/active") {
    try {
      const diskResume = await readActiveResumeRobust();
      if (diskResume) {
        currentRuntime().core.hydrateResume(diskResume);
      }
      const resume = diskResume || currentRuntime().core.getResume();
      return sendJson(res, 200, { resume, activeResumePath });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "GET" && requestPath === "/api/context") {
    try {
      const context = await readContextState();
      return sendJson(res, 200, { context });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/context/selection") {
    try {
      const body = await readJson(req);
      await writeSelectionState(body);
      const context = await readContextState();
      return sendJson(res, 200, { ok: true, context });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/context/view") {
    try {
      const body = await readJson(req);
      const context = await writeContextState({ view: body });
      return sendJson(res, 200, { ok: true, context });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/context/document") {
    try {
      const { context, document } = await runSerialized(async () => {
        const body = await readJson(req);
        return syncRuntimeDocument(body, { forceRevisionBump: false });
      });
      return sendJson(res, 200, { ok: true, context, document });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "GET" && requestPath === "/api/resume/stream") {
    openSseStream(req, res, resumeStreams);
    readActiveResume()
      .then((resume) => writeSse(res, "resume", { resume }))
      .catch(() => {});
    return;
  }

  if (req.method === "GET" && requestPath === "/api/activity/state") {
      const state = await readActivityState();
      return sendJson(res, 200, {
        state,
        session: currentRuntime().activeSession,
        workspaceDir,
        terminalAgentPath
      });
  }

  if (req.method === "GET" && requestPath === "/api/activity/stream") {
    openSseStream(req, res, activityStreams);
    readActivityState()
      .then((state) => writeSse(res, "state", { state, workspaceDir, terminalAgentPath }))
      .catch(() => {});
    return;
  }

  if (req.method === "GET" && requestPath === "/api/files") {
    try {
      const files = await listResumeDocuments();
      return sendJson(res, 200, { files });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "GET" && requestPath === "/api/resume/history") {
    try {
      const archives = await listResumeArchives();
      return sendJson(res, 200, { archives });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/resume/archive") {
    try {
      const body = await readJson(req);
      const archive = await createResumeArchive(body.reason || "manual");
      return sendJson(res, 200, { ok: true, archive });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  // Presentation-only autosave. The workbench debounces style edits here instead of
  // sending the whole resume, so a background autosave can never overwrite content —
  // it merges one key onto whatever the runtime currently holds.
  if (req.method === "POST" && requestPath === "/api/resume/style") {
    try {
      const resume = await runSerialized(async () => {
        const body = await readJson(req);
        if (!body.styleSettings || typeof body.styleSettings !== "object") {
          throw new Error("styleSettings must be an object");
        }
        const core = currentRuntime().core;
        core.setResume({ ...core.getResume(), styleSettings: body.styleSettings });
        return core.getResume();
      });
      await broadcastResume();
      return sendJson(res, 200, { ok: true, styleSettings: resume.styleSettings });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Content autosave. Style settings had their own debounced autosave while text,
  // inline styling, and per-field styling lived only in React state, so anything
  // the user typed was lost when the window closed — and was overwritten the
  // moment a resume broadcast arrived. This is the counterpart write path.
  //
  // Autosaving while a patch awaits review is safe and in fact necessary: accept
  // compares the patch's recorded `before` against the resume on disk, so an edit
  // to an unrelated field simply persists, and an edit to the *patched* field is a
  // genuine conflict that the review UI should report rather than hide.
  if (req.method === "POST" && requestPath === "/api/resume/content") {
    try {
      await runSerialized(async () => {
        const body = await readJson(req);
        const resume = body.resume;
        if (!resume || typeof resume !== "object" || Array.isArray(resume)) {
          throw new Error("resume must be an object");
        }
        currentRuntime().core.setResume(resume);
      });
      await broadcastResume();
      return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/resume/new") {
    try {
      const { result, synced } = await runSerialized(async () => {
        const body = await readJson(req);
        const result = await createNewResumeFromTemplate(body.reason || "new-resume");
        currentRuntime().core.hydrateResume(result.resume);
        const synced = await syncRuntimeDocument(
          {
            mode: "template",
            fileName: "",
            historyFileName: "",
            title: `${result.resume.name || "Your Name"}-resume`,
            activeResumePath
          },
          { forceRevisionBump: true }
        );
        return { result, synced };
      });
      await broadcastResume();
      return sendJson(res, 200, { ok: true, ...result, context: synced.context, activeDocument: synced.document });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/resume/history/open") {
    try {
      const { result, synced } = await runSerialized(async () => {
        const body = await readJson(req);
        const result = await restoreResumeArchive(body.fileName);
        currentRuntime().core.hydrateResume(result.resume);
        const synced = await syncRuntimeDocument(
          {
            mode: "history",
            fileName: "",
            historyFileName: result.fileName,
            title: result.fileName,
            activeResumePath
          },
          { forceRevisionBump: true }
        );
        return { result, synced };
      });
      await broadcastResume();
      return sendJson(res, 200, { ok: true, ...result, context: synced.context, activeDocument: synced.document });
    } catch (error) {
      const status = /stale pending patch/i.test(error.message) ? 409 : 400;
      return sendJson(res, status, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/files/save") {
    try {
      const { saved, synced } = await runSerialized(async () => {
        const body = await readJson(req);
        const saved = await saveResumeDocument(body.resume, body.fileName);
        currentRuntime().core.setResume(saved.document.resume);
        const synced = await syncRuntimeDocument(
          {
            mode: "file",
            fileName: saved.fileName,
            historyFileName: "",
            title: saved.document?.meta?.title || saved.fileName,
            activeResumePath
          },
          { forceRevisionBump: true }
        );
        return { saved, synced };
      });
      await broadcastResume();
      return sendJson(res, 200, {
        fileName: saved.fileName,
        fullPath: saved.fullPath,
        document: saved.document,
        context: synced.context,
        activeDocument: synced.document
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/files/open") {
    try {
      const { opened, synced } = await runSerialized(async () => {
        const body = await readJson(req);
        const opened = await openResumeDocument(body.fileName);
        currentRuntime().core.setResume(opened.document.resume);
        const synced = await syncRuntimeDocument(
          {
            mode: "file",
            fileName: opened.fileName,
            historyFileName: "",
            title: opened.document?.meta?.title || opened.fileName,
            activeResumePath
          },
          { forceRevisionBump: true }
        );
        return { opened, synced };
      });
      await broadcastResume();
      return sendJson(res, 200, { ...opened, context: synced.context, activeDocument: synced.document });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/selection") {
    try {
      const body = await readJson(req);
      const selection = {
        fieldId: body.fieldId || null,
        sectionId: body.sectionId || null,
        updatedAt: new Date().toISOString()
      };
      currentRuntime().core.setSelection(selection);
      await writeSelectionState(selection);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "GET" && requestPath === "/api/selection") {
    try {
      const selection = currentRuntime().core.getSelection() || await readSelectionState();
      return sendJson(res, 200, { selection });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "GET" && requestPath === "/api/patch/pending") {
    try {
      return sendJson(res, 200, pendingPayload());
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "GET" && requestPath === "/api/patch/stream") {
    openSseStream(req, res, pendingStreams);
    writeSse(res, "pending", pendingPayload());
    return;
  }

  if (req.method === "POST" && requestPath === "/api/patch/confirm") {
    try {
      const result = await runSerialized(async () => {
        const body = await readJson(req);
        const { core, persistence } = currentRuntime();
        const documentResult = await hydrateRuntimeDocumentFromContext();
        if (documentResult?.clearedPendingPatch) {
          broadcastPending();
          throw new Error("Stale pending patch: active document changed");
        }
        // Content authority is the file on disk — that is where agents write and
        // what the resume stream syncs to the client. Hydrating from the client's
        // whole resume meant conflict detection compared its copy against itself,
        // so an edit that landed on disk between propose and accept was silently
        // overwritten instead of reported. Only presentation keys, which the
        // workbench may hold unsaved, are taken from the request.
        const diskResume = await readActiveResumeRobust();
        const baseResume = diskResume || core.getResume();
        core.hydrateResume(
          body.resume && typeof body.resume === "object"
            ? mergePresentationOnto(baseResume, body.resume)
            : baseResume
        );
        core.hydratePendingPatch(persistence.loadPendingPatch());
        // Checkpoint the pre-patch state before anything is applied, so accepting an
        // AI change is always recoverable from the history panel. Archive the runtime
        // resume rather than the file: the client's copy (with unsaved styling) is
        // what the user is actually looking at, and it is not on disk yet.
        const checkpoint = await createResumeArchive(AUTO_ARCHIVE_REASON, {
          resume: core.getResume(),
          prune: true
        });
        core.confirmPendingPatch({
          pendingId: body.pendingId,
          allowConflict: body.allowConflict === true
        });
        return {
          patch: null,
          resume: core.getResume(),
          checkpoint: { fileName: checkpoint.fileName, archivedAt: checkpoint.archivedAt }
        };
      });
      await broadcastResume();
      broadcastPending();
      return sendJson(res, 200, {
        ok: true,
        patch: result.patch,
        resume: result.resume,
        checkpoint: result.checkpoint
      });
    } catch (error) {
      if (error.name === "PendingPatchConflict") {
        return sendJson(res, 409, { error: error.message, conflicts: error.conflicts || [] });
      }
      const status = /stale pending patch/i.test(error.message) ? 409 : 400;
      return sendJson(res, status, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/patch/reject") {
    try {
      const result = await runSerialized(async () => {
        const body = await readJson(req);
        const { core, persistence } = currentRuntime();
        const documentResult = await hydrateRuntimeDocumentFromContext();
        if (documentResult?.clearedPendingPatch) {
          broadcastPending();
          throw new Error("Stale pending patch: active document changed");
        }
        core.hydratePendingPatch(persistence.loadPendingPatch());
        core.rejectPendingPatch({
          pendingId: body.pendingId
        });
        return { rejected: true };
      });
      broadcastPending();
      return sendJson(res, 200, { ok: true, rejected: result.rejected });
    } catch (error) {
      const status = /stale pending patch/i.test(error.message) ? 409 : 400;
      return sendJson(res, status, { error: error.message });
    }
  }

  if (req.method === "POST" && requestPath === "/api/export-pdf") {
    // Deprecated: PDF export is now "preview-as-export" — the renderer prints
    // the on-screen resume page directly (Electron printToPDF / window.print
    // with @media print CSS). The old engine renderHtml path has been removed.
    return sendJson(res, 410, {
      error: "Server-side PDF export removed. Use the workbench export (preview-as-export)."
    });
  }

  // The only agent write path: stage a pending patch for user review.
  // Kept at /api/actions for backwards compatibility with existing CLI/demo callers.
  if (
    req.method === "POST" &&
    (requestPath === "/api/patch/propose" || requestPath === "/api/actions")
  ) {
    try {
      const body = await readJson(req);
      const patch = body.patch;

      if (!patch || typeof patch !== "object" || !patch.sectionId) {
        return sendJson(res, 400, {
          error: "Missing patch: expected { patch: { sectionId, after, index?, field?, bulletIndex? } }"
        });
      }

      // A client that sends `index: null` (JSON.stringify of a NaN from a bad CLI
      // flag) would otherwise be read as "no index" and silently target item 0.
      // Absent is fine and means 0; present-but-not-an-index is an error.
      for (const key of ["index", "bulletIndex"]) {
        if (patch[key] === undefined) continue;
        if (!Number.isInteger(patch[key]) || patch[key] < 0) {
          return sendJson(res, 400, {
            error: `patch.${key} must be a non-negative integer, received ${JSON.stringify(patch[key])}`
          });
        }
      }
      if (typeof patch.field !== "undefined" && typeof patch.field !== "string") {
        return sendJson(res, 400, { error: "patch.field must be a string when provided" });
      }

      // Propose used to run outside the mutation queue while confirm and reject
      // ran inside it, so a propose could interleave with a confirm and write the
      // pending slot the confirm was in the middle of consuming. All three now
      // serialize against each other.
      //
      // Validation happens before any byte of the response is sent: the old code
      // set NDJSON headers first, so a late failure hit the catch below and tried
      // to send a JSON error after headers were already on the wire.
      const staged = await runSerialized(async () => {
        const { activeSession, core } = currentRuntime();
        syncPendingFromDisk();
        const baseResume = await readActiveResumeRobust();
        if (baseResume) core.hydrateResume(baseResume);
        const pending = core.proposeSectionEdit({
          sessionId: activeSession.sessionId,
          sectionId: patch.sectionId,
          index: patch.index,
          field: patch.field,
          bulletIndex: patch.bulletIndex,
          content: patch.after,
          replace: patch.replace === true
        });
        return { pending, resume: core.getResume() };
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      streamStagedPatch(res, patch, staged);
      return;
    } catch (error) {
      if (res.headersSent) {
        // Nothing useful can be said on the wire any more; end the stream rather
        // than crashing the request handler.
        try {
          res.end();
        } catch {
          // socket already gone
        }
        return;
      }
      if (error.name === "PendingPatchExists") {
        return sendJson(res, 409, { error: error.message, pendingId: error.pendingId });
      }
      const status = /^(Active document context|.*does not exist|.*is invalid|proposeEdit)/.test(error.message)
        ? 400
        : 500;
      return sendJson(res, status, { error: error.message });
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

// Discovery file: lets external CLIs locate the running bridge instance
// (port, token, workspace) instead of guessing a port or workspace path.
// Stored under ~/.resume-studio/ so it is shared across dev and packaged runs.
const discoveryPath = path.join(homedir(), ".resume-studio", "runtime.json");

async function publishRuntimeDiscovery(port) {
  // Skip in tests: they spin up bridges against throwaway temp workspaces and
  // would otherwise clobber the discovery file a real APP instance published.
  if (process.env.NODE_ENV === "test" || process.env.RESUME_SKIP_DISCOVERY) return;
  try {
    // 0o700 on the directory and 0o600 on the file: this holds the bridge's auth
    // token, which was previously written with the default umask (0644) and so
    // readable by every account on the machine.
    await mkdir(path.dirname(discoveryPath), { recursive: true, mode: 0o700 });
    await chmod(path.dirname(discoveryPath), 0o700).catch(() => {});
    await writeJsonAtomic(discoveryPath, {
      port,
      baseUrl: `http://127.0.0.1:${port}`,
      token: configuredToken,
      workspaceDir,
      activeResumePath,
      pid: process.pid,
      startedAt: new Date().toISOString()
    });
    await chmod(discoveryPath, 0o600).catch(() => {});
  } catch {
    // Discovery is best-effort; the bridge still works without it.
  }
}

export function startBridgeServer(port = configuredPort) {
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    ensureBridgeToken();
    await ensureWorkspace();
    await ensureActiveResume(defaultResume);
    await migrateActiveResumeFile(defaultResume);
    const runtime = initializeRuntime({
      workspaceDir,
      resume: await readActiveResume()
    });
    await reconcileStartupDocumentBinding();

    try {
      await readFile(pendingPatchPath, "utf8");
    } catch {
      await writeFileAtomic(pendingPatchPath, "");
    }

    try {
      const raw = await readFile(activityLogPath, "utf8");
      activityOffset = raw.length;
    } catch {
      activityOffset = 0;
    }

    if (!watchersAttached) {
      watchersAttached = true;
      // A watcher that throws its error event unhandled takes the process down,
      // and every write now goes through rename, which invalidates macOS watches.
      // Each watcher is therefore optional; the mtime poll below is the real
      // guarantee and these are only a latency optimisation.
      const attachWatcher = (target, onChange) => {
        try {
          const watcher = watch(target, { persistent: false }, onChange);
          watcher.on("error", () => {});
          disposables.push(() => watcher.close());
        } catch {
          // Missing file; the polling fallback covers it.
        }
      };

      attachWatcher(activeResumePath, () => broadcastResume());
      attachWatcher(activityLogPath, () => broadcastActivityChunk());
      attachWatcher(pendingPatchPath, () => broadcastPending());

      // 兜底轮询：watch 在 macOS 下被原子写入(rename 换 inode)后会静默失效。
      // 每秒比对 mtime，变化即广播，确保 watch 失效时左侧也能 ~1s 内自愈。
      let lastResumeMtimeMs = 0;
      let lastPendingMtimeMs = 0;
      const poll = setInterval(async () => {
        try {
          const { mtimeMs } = await stat(activeResumePath);
          if (mtimeMs !== lastResumeMtimeMs) {
            lastResumeMtimeMs = mtimeMs;
            broadcastResume();
          }
        } catch {}
        try {
          const { mtimeMs } = await stat(pendingPatchPath);
          if (mtimeMs !== lastPendingMtimeMs) {
            lastPendingMtimeMs = mtimeMs;
            broadcastPending();
          }
        } catch {}
      }, 1000);
      poll.unref();
      disposables.push(() => clearInterval(poll));
    }

    if (!server.listening) {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "127.0.0.1");
      });
    }

    console.log(`Resume bridge listening on http://127.0.0.1:${port}`);
    console.log(`Workspace ready at ${workspaceDir}`);

    // Publish a discovery file so external CLIs can find this running instance
    // (port + token + workspace) without guessing. Written to a stable
    // user-level location so it works for both dev and packaged app runs.
    await publishRuntimeDiscovery(port);

    return {
      port,
      runtime,
      server,
      workspaceDir
    };
  })().catch((error) => {
    startupPromise = null;
    throw error;
  });

  return startupPromise;
}

// Closing the listener, the watchers, and the open SSE sockets lets Electron's
// before-quit actually release the port instead of relying on process exit.
export async function stopBridgeServer() {
  while (disposables.length) {
    const dispose = disposables.pop();
    try {
      dispose();
    } catch {
      // Best effort: a disposer that fails must not block the rest.
    }
  }
  if (broadcastTimer) {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
  }
  for (const streams of [resumeStreams, activityStreams, pendingStreams]) {
    for (const res of [...streams]) {
      try {
        res.end();
      } catch {
        // socket already gone
      }
    }
    streams.clear();
  }
  watchersAttached = false;
  startupPromise = null;
  if (server.listening) {
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startBridgeServer().catch((error) => {
    console.error("Failed to start resume bridge:", error);
    process.exitCode = 1;
  });
}
