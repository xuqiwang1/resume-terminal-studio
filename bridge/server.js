import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actionCatalog } from "./actions.js";
import runtimeModule from "./core/runtime.cjs";
import resumeEngine from "./bin/resume-engine.cjs";
import defaultResumeModule from "./defaultResume.cjs";
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

const DEFAULT_PORT = 4318;
const configuredPort = Number(process.env.RESUME_BRIDGE_PORT || DEFAULT_PORT);
const configuredToken = process.env.RESUME_BRIDGE_TOKEN || "";
const resumeStreams = new Set();
const activityStreams = new Set();
const pendingStreams = new Set();
let activityOffset = 0;
let startupPromise = null;
let watchersAttached = false;
let mutationQueue = Promise.resolve();

const defaultResume = createDefaultResume();

const sendJson = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
};

export function isAuthorizedRequest(req, token = configuredToken) {
  if (!token) return true;
  const headerToken = req.headers?.["x-resume-studio-token"];
  if (headerToken === token) return true;
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    return url.searchParams.get("token") === token;
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

const writeSse = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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
  const requestedRevision = Number(documentPatch?.revision);
  const shouldBump = forceRevisionBump || !sameDocumentBinding(currentContext.document, nextDocument);
  const revision = shouldBump
    ? currentRevision + 1
    : Number.isFinite(requestedRevision)
      ? Math.max(0, Math.floor(requestedRevision))
      : currentRevision;
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

const handleDirectPatch = async (res, patch) => {
  const baseResume = await readActiveResume();
  const { sectionId, after, index, field } = patch;
  const before = patch.before ??
    (sectionId === "summary" ? baseResume.summary :
     sectionId === "experience" ? baseResume.experience?.[index ?? 0]?.[field || "details"] :
     sectionId === "projects" ? baseResume.projects?.[index ?? 0]?.[field || "details"] :
     sectionId === "title" ? baseResume.title :
     sectionId === "contact" ? baseResume.contact : "");

  const targetLabel =
    sectionId === "summary" ? "个人总结" :
    sectionId === "experience" ? "工作经历" :
    sectionId === "projects" ? "项目经历" : sectionId;

  writeLine(res, { type: "activity", payload: { label: "Agent", state: "Started", text: `正在重写${targetLabel}…` } });
  writeLine(res, { type: "focus", payload: { sectionId } });
  await sleep(600);

  writeLine(res, { type: "activity", payload: { label: "Rewrite", state: "Editing", text: `正在生成新的${targetLabel}文案。`, sectionId } });
  await sleep(800);

  const { activeSession, core } = currentRuntime();
  const pending = core.proposeSectionEdit({
    sessionId: activeSession.sessionId,
    sectionId,
    index,
    field,
    bulletIndex: patch.bulletIndex,
    content: after
  });
  const finalPatch = pending;

  writeLine(res, { type: "activity", payload: { label: "Patch", state: "Pending", text: `${targetLabel}已生成待确认改动。` } });
  writeLine(res, { type: "patch", payload: finalPatch });
  writeLine(res, { type: "pending", payload: pending });
  broadcastPending();
  await sleep(60);

  writeLine(res, { type: "activity", payload: { label: "Result", state: "Review", text: `${targetLabel}等待用户接受。`, done: true } });
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
  resumeStreams.forEach((res) => writeSse(res, "resume", { resume }));
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
const broadcastPending = () => {
  const { core, persistence } = currentRuntime();
  const pending = persistence.loadPendingPatch();
  core.hydratePendingPatch(pending);
  pendingStreams.forEach((res) => writeSse(res, "pending", { pending: pending || null }));
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
    const events = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    activityStreams.forEach((res) => {
      for (const event of events) {
        writeSse(res, "activity", { event, state });
      }
    });
  } catch {}
};

const server = createServer(async (req, res) => {
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    resumeStreams.add(res);
    readActiveResume()
      .then((resume) => writeSse(res, "resume", { resume }))
      .catch(() => {});
    req.on("close", () => {
      resumeStreams.delete(res);
    });
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    activityStreams.add(res);
    readActivityState()
      .then((state) => writeSse(res, "state", { state, workspaceDir, terminalAgentPath }))
      .catch(() => {});
    req.on("close", () => {
      activityStreams.delete(res);
    });
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
    const { core, persistence } = currentRuntime();
    const pending = persistence.loadPendingPatch();
    core.hydratePendingPatch(pending);
    return sendJson(res, 200, { pending: pending || null });
  }

  if (req.method === "GET" && requestPath === "/api/patch/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    pendingStreams.add(res);
    const { core, persistence } = currentRuntime();
    const pending = persistence.loadPendingPatch();
    core.hydratePendingPatch(pending);
    writeSse(res, "pending", { pending: pending || null });
    req.on("close", () => {
      pendingStreams.delete(res);
    });
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
        core.hydratePendingPatch(persistence.loadPendingPatch());
        core.confirmPendingPatch({
          pendingId: body.pendingId
        });
        return {
          patch: null,
          resume: core.getResume()
        };
      });
      await broadcastResume();
      broadcastPending();
      return sendJson(res, 200, { ok: true, patch: result.patch, resume: result.resume });
    } catch (error) {
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

  if (req.method === "POST" && requestPath === "/api/actions") {
    try {
      const body = await readJson(req);

      if (body.action === "direct_patch") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        await handleDirectPatch(res, body.patch);
        return;
      }

      const action = actionCatalog[body.action];

      if (!action) {
        return sendJson(res, 404, { error: "Unknown action" });
      }

      const patch = action.patch(body.resume);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const child = spawn("/bin/zsh", ["-lc", action.command], { cwd: workspaceDir });
      let finalResume = body.resume;

      child.stdout.on("data", async (chunk) => {
        const lines = chunk
          .toString()
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of lines) {
          const mapped = action.activityMap[line] || {
            label: "Terminal",
            state: "Running",
            text: line
          };

          writeLine(res, { type: "activity", payload: mapped });

          if (mapped.sectionId) {
            writeLine(res, {
              type: "focus",
              payload: { sectionId: mapped.sectionId }
            });
          }

          if (mapped.emitPatch && patch) {
            const { activeSession, core } = currentRuntime();
            const pending = core.proposeSectionEdit({
              sessionId: activeSession.sessionId,
              sectionId: patch.sectionId,
              index: patch.index,
              field: patch.field,
              bulletIndex: patch.bulletIndex,
              content: patch.after
            });
            const pendingPatch = pending;
            writeLine(res, {
              type: "draft",
              payload: {
                sectionId: patch.sectionId,
                text: patch.after || "",
                status: "complete"
              }
            });
            writeLine(res, { type: "patch", payload: pendingPatch });
            writeLine(res, { type: "pending", payload: pending });
            broadcastPending();
          }

          if (mapped.done) {
            writeLine(res, { type: "done", payload: { ok: true } });
          }
        }
      });

      child.stderr.on("data", (chunk) => {
        writeLine(res, {
          type: "activity",
          payload: {
            label: "stderr",
            state: "Error",
            text: chunk.toString()
          }
        });
      });

      child.on("close", (code) => {
        if (code !== 0) {
          writeLine(res, {
            type: "done",
            payload: { ok: false, code }
          });
        }
        res.end();
      });

      return;
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

export function startBridgeServer(port = configuredPort) {
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
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
      await writeFile(pendingPatchPath, "", "utf8");
    }

    try {
      const raw = await readFile(activityLogPath, "utf8");
      activityOffset = raw.length;
    } catch {
      activityOffset = 0;
    }

    if (!watchersAttached) {
      watchersAttached = true;
      watch(activeResumePath, { persistent: false }, () => {
        broadcastResume();
      });
      watch(activityLogPath, { persistent: false }, () => {
        broadcastActivityChunk();
      });
      try {
        watch(pendingPatchPath, { persistent: false }, () => {
          broadcastPending();
        });
      } catch {
        // pending-patch.json may not exist yet; the polling fallback below covers it.
      }

      // 兜底轮询：watch 在 macOS 下被原子写入(rename 换 inode)后会静默失效。
      // 每秒比对 mtime，变化即广播，确保 watch 失效时左侧也能 ~1s 内自愈。
      let lastResumeMtimeMs = 0;
      setInterval(async () => {
        try {
          const { mtimeMs } = await stat(activeResumePath);
          if (mtimeMs !== lastResumeMtimeMs) {
            lastResumeMtimeMs = mtimeMs;
            broadcastResume();
          }
        } catch {}
      }, 1000).unref();
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

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startBridgeServer();
}
