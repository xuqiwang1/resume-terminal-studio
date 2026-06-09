import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runBridgeAction } from "../lib/bridgeClient";
import { desktopSessionInfo } from "../lib/appClient";
import { toSegments, applyStyleToRange, toPlainText } from "../lib/richText";
import {
  describePendingPatch,
  FIELD_LABELS,
  getPendingPatchPrimarySection,
  parseFieldId,
  patchFieldId,
  SECTION_LABELS,
  sectionIdFromFieldId,
  textForField
} from "./resumeStudioHelpers";
import {
  fetchActiveResume,
  fetchActivityState,
  fetchBridgeHealth,
  fetchContext,
  fetchPendingPatch,
  listResumeFiles,
  listResumeHistory,
  archiveCurrentResume,
  createNewResume,
  openResumeFile,
  openResumeArchive,
  saveResumeToFile,
  subscribeActivityUpdates,
  subscribeResumeUpdates,
  subscribePendingUpdates,
  confirmPendingPatch,
  rejectPendingPatch,
  syncContextDocument,
  syncContextSelection,
  syncContextView,
} from "../lib/fileClient";
import { actionDefinitions, initialActivity, initialResume } from "../data/mockResume";

const A4_HEIGHT_PX = 297 * 3.78;
const A4_HEIGHT_TOLERANCE_PX = 2;

function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function buildDocumentState({
  mode,
  fileName = "",
  historyFileName = "",
  title = "",
  activeResumePath = ""
}) {
  return {
    mode,
    fileName,
    historyFileName,
    title,
    activeResumePath
  };
}

export function useResumeStudio() {
  const [resume, setResume] = useState(initialResume);
  const [activeSectionId, setActiveSectionId] = useState("summary");
  const [activityItems, setActivityItems] = useState(initialActivity);
  const [diff, setDiff] = useState({ before: "", after: "" });
  const [flashToken, setFlashToken] = useState(null);
  const [draftState, setDraftState] = useState(null);
  const [bridgeStatus, setBridgeStatus] = useState({
    ok: false,
    workspaceDir: "",
    activeResumePath: "",
    terminalAgentPath: "",
    activityLogPath: "",
    session: desktopSessionInfo(),
    runtimeReady: Boolean(desktopSessionInfo()?.runtimeReady)
  });
  const [recentFiles, setRecentFiles] = useState([]);
  const [resumeArchives, setResumeArchives] = useState([]);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("");
  const [activityState, setActivityState] = useState({
    lastCommand: "",
    status: "idle",
    updatedAt: "",
    session: null
  });

  const [selectedField, setSelectedField] = useState(null);
  const [workingSection, setWorkingSection] = useState(null);
  const [pendingPatch, setPendingPatch] = useState(null);
  const [patchAnimation, setPatchAnimation] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [templateId, setTemplateId] = useState("professional");
  const [fontId, setFontId] = useState("serif");
  const [colorId, setColorId] = useState("black");
  const [lineHeight, setLineHeight] = useState(1.65);
  const [sectionGap, setSectionGap] = useState(14);
  const [pagePadding, setPagePadding] = useState(36);
  const [fontSize, setFontSize] = useState({ heading: 22, body: 12, muted: 11 });
  const [ruleStyle, setRuleStyle] = useState("thick");
  const [avatar, setAvatarState] = useState(initialResume.avatar ?? null);
  const [avatarPos, setAvatarPos] = useState({ x: 0, y: 0 });
  const [fieldStyles, setFieldStyles] = useState(initialResume.fieldStyles || {});
  const [layoutConfig, setLayoutConfig] = useState({
    education: { schoolAlign: "center", majorAlign: "right" },
    skills: { layout: "block" }
  });

  // Keep avatar in the persisted resume object so it survives save/load and is
  // consistent across templates that read resume.avatar. Avatar is uploaded in
  // the workbench (not via agent propose_edit).
  const setAvatar = useCallback((value) => {
    const next = value ?? null;
    setAvatarState(next);
    setResume((prev) => ({ ...prev, avatar: next }));
  }, []);

  const prevResumeRef = useRef(null);
  const initialLoadDone = useRef(false);

  const pushActivityItem = useCallback((item) => {
    setActivityItems((current) => [item, ...current]);
  }, []);

  const applyResumeSnapshot = useCallback((nextResume, options = {}) => {
    const { updatePrevious = false } = options;
    if (updatePrevious) {
      prevResumeRef.current = nextResume;
    }
    setResume(nextResume);
    setFieldStyles(nextResume?.fieldStyles || {});
    if (nextResume && nextResume.avatar !== undefined) {
      setAvatarState(nextResume.avatar ?? null);
    }
  }, []);

  const syncDocumentState = useCallback((document) => {
    return syncContextDocument(document);
  }, []);

  const onSelectField = useCallback((fid) => {
    setSelectedField(fid);
    const parsed = parseFieldId(fid);
    const sectionId = parsed.sectionId || sectionIdFromFieldId(fid);
    if (sectionId) setActiveSectionId(sectionId === "header" ? "summary" : sectionId);
    const selection = {
      fieldId: fid,
      sectionId: parsed.sectionId,
      index: parsed.index,
      field: parsed.field,
      sectionLabel: SECTION_LABELS[parsed.sectionId] || "",
      fieldLabel: FIELD_LABELS[parsed.field] || "",
      textPreview: textForField(resume, fid)
    };
    syncContextSelection(selection).catch(() => {});
  }, [resume]);

  const syncView = useCallback((view) => {
    syncContextView(view).catch(() => {});
  }, []);

  const onPatchAnimationComplete = useCallback(() => {
    setPatchAnimation(null);
  }, []);

  const applyInlineStyle = useCallback((fieldId, startOffset, endOffset, styleKey, styleValue) => {
    setResume((prev) => {
      const next = { ...prev };
      const resolveField = (fid) => {
        const parts = fid.split(".");
        if (parts[0] === "summary" && parts[1] === "text") return { get: () => prev.summary, set: (v) => { next.summary = v; } };
        if (parts[0] === "header") return { get: () => prev[parts[1]], set: (v) => { next[parts[1]] = v; } };
        if (parts[0] === "experience" || parts[0] === "projects") {
          const idx = parseInt(parts[1]);
          const field = parts[2];
          const arr = [...(prev[parts[0]] || [])];
          return {
            get: () => arr[idx]?.[field],
            set: (v) => { arr[idx] = { ...arr[idx], [field]: v }; next[parts[0]] = arr; }
          };
        }
        return null;
      };

      const f = resolveField(fieldId);
      if (!f) return prev;

      const currentValue = f.get();
      const segments = toSegments(currentValue);
      const updated = applyStyleToRange(segments, startOffset, endOffset, styleKey, styleValue);
      f.set(updated);
      return next;
    });
  }, []);

  const applyFieldStyle = useCallback((fieldId, styleKey, styleValue) => {
    if (!fieldId) return;
    setResume((prev) => {
      const nextFieldStyles = {
        ...(prev.fieldStyles || {}),
        [fieldId]: {
          ...((prev.fieldStyles || {})[fieldId] || {}),
          [styleKey]: styleValue
        }
      };
      setFieldStyles(nextFieldStyles);
      return { ...prev, fieldStyles: nextFieldStyles };
    });
  }, []);

  const refreshFiles = async () => {
    const data = await listResumeFiles();
    setRecentFiles(data.files || []);
  };

  const refreshHistory = async () => {
    const data = await listResumeHistory();
    setResumeArchives(data.archives || []);
  };

  useEffect(() => {
    let stopResumeStream = () => {};
    let stopActivityStream = () => {};
    let stopPendingStream = () => {};
    const desktopSession = desktopSessionInfo();
    fetchBridgeHealth()
      .then((data) =>
        setBridgeStatus({
          ok: !!data.ok,
          workspaceDir: data.workspaceDir || "",
          activeResumePath: data.activeResumePath || "",
          terminalAgentPath: data.terminalAgentPath || "",
          activityLogPath: data.activityLogPath || "",
          session: data.session || desktopSession,
          runtimeReady: Boolean(desktopSession?.runtimeReady)
        })
      )
      .catch(() =>
        setBridgeStatus({
          ok: false,
          workspaceDir: "",
          activeResumePath: "",
          terminalAgentPath: "",
          activityLogPath: "",
          session: desktopSession,
          runtimeReady: Boolean(desktopSession?.runtimeReady)
        })
      );

    fetchActiveResume()
      .then((data) => {
        const r = data.resume || initialResume;
        applyResumeSnapshot(r, { updatePrevious: true });
        const activeResumePath = data.activeResumePath || "";
        fetchContext()
          .then((contextData) => {
            const existingDocument = contextData.context?.document;
            const sameActivePath = existingDocument?.activeResumePath === activeResumePath;
            if (!sameActivePath) {
              syncDocumentState(
                buildDocumentState({
                  mode: "template",
                  fileName: "",
                  historyFileName: "",
                  title: `${r.name || "Your Name"}-resume`,
                  activeResumePath
                })
              ).catch(() => {});
            }
          })
          .catch(() => {
            syncDocumentState(
              buildDocumentState({
                mode: "template",
                fileName: "",
                historyFileName: "",
                title: `${r.name || "Your Name"}-resume`,
                activeResumePath
              })
            ).catch(() => {});
          });
        initialLoadDone.current = true;
      })
      .catch(() => {
        prevResumeRef.current = initialResume;
        initialLoadDone.current = true;
      });

    fetchActivityState()
      .then((data) => setActivityState(data.state || {}))
      .catch(() => {});

    fetchPendingPatch()
      .then((data) => setPendingPatch(data.pending || null))
      .catch((e) => {
        pushActivityItem({
          label: "Pending",
          state: "Error",
          text: `读取待确认改动失败：${e.message}`
        });
      });

    stopResumeStream = subscribeResumeUpdates((nextResume) => {
      // File watchers can emit several times for one disk write, and external
      // agents may write active-resume.json repeatedly while drafting. Treat the
      // stream as state sync only; patch animation is driven by explicit patch
      // events/confirm actions so it cannot replay in a loop.
      applyResumeSnapshot(nextResume, { updatePrevious: true });
    });

    stopActivityStream = subscribeActivityUpdates({
      state: (payload) => {
        setActivityState(payload.state || {});
      },
      activity: ({ event, state }) => {
        setActivityState(state || {});
        if (event.type === "command:start") {
          pushActivityItem({
            label: "Terminal",
            state: "Started",
            text: `在本机终端执行：resume-agent ${[event.command, ...(event.args || [])].join(" ")}`
          });
        }
        if (event.type === "stdout") {
          pushActivityItem({
            label: "stdout",
            state: "Running",
            text: event.text
          });
        }
        if (event.type === "intent") {
          setWorkingSection(
            event.target === "title" || event.target === "contact" ? "summary" : event.target
          );
          pushActivityItem({
            label: "Intent",
            state: "Parsed",
            text: `已解析意图：${event.instruction} → ${event.target}`
          });
        }
        if (event.type === "stderr") {
          pushActivityItem({
            label: "stderr",
            state: "Error",
            text: event.text
          });
        }
        if (event.type === "patch") {
          setDraftState(null);
          setDiff({ before: event.before || "", after: event.after || "" });
          const resolvedSection =
            event.sectionId === "title" || event.sectionId === "contact"
              ? "summary"
              : event.sectionId;
          setActiveSectionId(resolvedSection);
          setFlashToken({
            sectionId: resolvedSection,
            id: `${event.sectionId}-${Date.now()}`
          });

          const fid = patchFieldId(event.sectionId);
          if (fid) {
            setPatchAnimation({
              fieldId: fid,
              before: event.before || "",
              after: event.after || "",
              active: true
            });
          }

          setWorkingSection(null);
        }
        if (event.type === "command:end") {
          setWorkingSection(null);
        }
      }
    });

    refreshFiles().catch(() => {});
    refreshHistory().catch(() => {});

    stopPendingStream = subscribePendingUpdates((pending) => {
      setPendingPatch(pending);
      if (pending) {
        const resolvedSection = getPendingPatchPrimarySection(pending);
        setActiveSectionId(resolvedSection);
        setWorkingSection(resolvedSection);
      } else {
        setWorkingSection(null);
      }
    });

    return () => {
      stopResumeStream();
      stopActivityStream();
      stopPendingStream();
    };
  }, [applyResumeSnapshot, pushActivityItem, syncDocumentState]);

  const runAction = async (actionId) => {
    setActivityItems([]);
    setDraftState(null);
    setPatchAnimation(null);
    setActionInProgress(true);
    await runBridgeAction({
      action: actionId,
      resume,
      selectedField,
      handlers: {
        activity: (payload) => {
          pushActivityItem(payload);
        },
        focus: (payload) => {
          setActiveSectionId(payload.sectionId);
          setWorkingSection(payload.sectionId);
          setFlashToken({
            sectionId: payload.sectionId,
            id: `${payload.sectionId}-${Date.now()}`
          });
        },
        patch: (payload) => {
          setDraftState(null);
          setDiff({ before: payload.before || "", after: payload.after || "" });

          const fid = patchFieldId(payload.sectionId);
          if (fid) {
            setPatchAnimation({
              fieldId: fid,
              before: payload.before || "",
              after: payload.after || "",
              active: true
            });
          }
        },
        draft: () => {
          // Suppress draft display during actions — AnimatedText handles the visual
        },
        resume: (payload) => {
          prevResumeRef.current = resume;
          applyResumeSnapshot(payload);
        },
        done: () => {
          setWorkingSection(null);
          setActionInProgress(false);
        }
      }
    });
    setActionInProgress(false);
  };

  const confirmPending = useCallback(async () => {
    if (!pendingPatch) return;
    setWorkingSection(null);
    try {
      const result = await confirmPendingPatch(pendingPatch.id);
      if (result?.resume) applyResumeSnapshot(result.resume, { updatePrevious: true });
      if (pendingPatch.kind !== "batch") {
        setDiff({ before: pendingPatch.before || "", after: pendingPatch.after || "" });
        const fid = patchFieldId(pendingPatch.sectionId, pendingPatch.index);
        if (fid) {
          setPatchAnimation({
            fieldId: fid,
            before: pendingPatch.before || "",
            after: pendingPatch.after || "",
            active: true
          });
        }
      }
      const resolvedSection = getPendingPatchPrimarySection(pendingPatch);
      setActiveSectionId(resolvedSection);
      pushActivityItem({
        label: "Patch",
        state: "Confirmed",
        text: `已接受 AI 改动并写入${describePendingPatch(pendingPatch)}。`
      });
    } catch (e) {
      pushActivityItem({ label: "Patch", state: "Error", text: `确认失败：${e.message}` });
    }
  }, [applyResumeSnapshot, pendingPatch, pushActivityItem]);

  const rejectPending = useCallback(async () => {
    if (!pendingPatch) return;
    setWorkingSection(null);
    try {
      await rejectPendingPatch(pendingPatch.id);
      pushActivityItem({ label: "Patch", state: "Rejected", text: "已拒绝本次 AI 改动，简历未改变。" });
    } catch (e) {
      pushActivityItem({ label: "Patch", state: "Error", text: `拒绝失败：${e.message}` });
    }
  }, [pendingPatch, pushActivityItem]);

  const saveCurrentResume = async () => {
    try {
      const saved = await saveResumeToFile({
        resume,
        fileName: currentFileName || `${resume.name || "resume"}-studio`
      });
      setCurrentFileName(saved.fileName);
      await refreshFiles();
      pushActivityItem({
        label: "File",
        state: "Saved",
        text: `已保存到本地文件：${saved.fileName}`
      });
    } catch (e) {
      pushActivityItem({
        label: "File",
        state: "Error",
        text: `保存失败：${e.message}`
      });
      throw e;
    }
  };

  const openLatestResume = async () => {
    const latest = recentFiles[0];
    if (!latest) return;
    const opened = await openResumeFile(latest.fileName);
    applyResumeSnapshot(opened.document.resume);
    setCurrentFileName(opened.fileName);
    setPendingPatch(null);
    pushActivityItem({
      label: "File",
      state: "Opened",
      text: `已打开本地文件：${opened.fileName}`
    });
  };

  const archiveCurrent = async () => {
    const saved = await archiveCurrentResume("manual-snapshot");
    await refreshHistory();
    pushActivityItem({
      label: "History",
      state: "Archived",
      text: `已保存历史版本：${saved.archive?.fileName || "snapshot"}`
    });
  };

  const startNewResume = async () => {
    const created = await createNewResume("new-template");
    const nextResume = created.resume;
    applyResumeSnapshot(nextResume, { updatePrevious: true });
    setCurrentFileName("");
    setDiff({ before: "", after: "" });
    setPatchAnimation(null);
    setActiveSectionId("education");
    setPendingPatch(null);
    await refreshHistory();
    pushActivityItem({
      label: "History",
      state: "New Template",
      text: `已归档当前简历，并打开新的空白模板。`
    });
  };

  const openArchive = async (fileName) => {
    const opened = await openResumeArchive(fileName);
    const nextResume = opened.resume;
    applyResumeSnapshot(nextResume, { updatePrevious: true });
    setCurrentFileName("");
    setDiff({ before: "", after: "" });
    setPatchAnimation(null);
    setPendingPatch(null);
    await refreshHistory();
    pushActivityItem({
      label: "History",
      state: "Restored",
      text: `已从历史版本恢复：${fileName}`
    });
  };

  const fitSinglePage = useCallback(async (target) => {
    let currentSectionGap = sectionGap;
    let currentPagePadding = pagePadding;
    let currentLineHeight = lineHeight;
    let currentFontSize = { ...fontSize };

    for (let step = 0; step < 80; step += 1) {
      await waitForLayout();
      const element = typeof target === "function" ? target() : target;
      if (!element) return false;

      const scrollHeight = element.scrollHeight;
      if (scrollHeight <= A4_HEIGHT_PX + A4_HEIGHT_TOLERANCE_PX) return true;

      let changed = false;

      // 1. Reduce section gap (low cost)
      if (currentSectionGap > 4) {
        currentSectionGap = Math.max(4, currentSectionGap - 2);
        setSectionGap(currentSectionGap);
        changed = true;
      }
      // 2. Reduce page padding (low-medium cost)
      else if (currentPagePadding > 16) {
        currentPagePadding = Math.max(16, currentPagePadding - 2);
        setPagePadding(currentPagePadding);
        changed = true;
      }
      // 3. Reduce line height (medium cost)
      else if (currentLineHeight > 1.25) {
        currentLineHeight = Math.max(1.25, currentLineHeight - 0.05);
        setLineHeight(currentLineHeight);
        changed = true;
      }
      // 4. Reduce font sizes (high cost)
      else if (currentFontSize.body > 9.5) {
        currentFontSize.body = Math.max(9.5, currentFontSize.body - 0.5);
        currentFontSize.muted = Math.max(8, currentFontSize.muted - 0.5);
        currentFontSize.heading = Math.max(16, currentFontSize.heading - 1);
        setFontSize({ ...currentFontSize });
        changed = true;
      }

      if (!changed) return false;
    }

    await waitForLayout();
    const element = typeof target === "function" ? target() : target;
    return !!element && element.scrollHeight <= A4_HEIGHT_PX + A4_HEIGHT_TOLERANCE_PX;
  }, [sectionGap, pagePadding, lineHeight, fontSize]);

  return {
    resume,
    activeSectionId,
    setActiveSectionId,
    activityItems,
    diff,
    flashToken,
    draftState,
    runAction,
    bridgeStatus,
    currentFileName,
    recentFiles,
    resumeArchives,
    historyPanelOpen,
    setHistoryPanelOpen,
    saveCurrentResume,
    openLatestResume,
    archiveCurrent,
    startNewResume,
    openArchive,
    refreshHistory,
    actions: useMemo(() => actionDefinitions, []),
    activityState,
    selectedField,
    onSelectField,
    syncView,
    workingSection,
    pendingPatch,
    confirmPending,
    rejectPending,
    patchAnimation,
    onPatchAnimationComplete,
    templateId, setTemplateId,
    fontId, setFontId,
    colorId, setColorId,
    lineHeight, setLineHeight,
    sectionGap, setSectionGap,
    pagePadding, setPagePadding,
    fontSize, setFontSize,
    ruleStyle, setRuleStyle,
    avatar, setAvatar,
    avatarPos, setAvatarPos,
    layoutConfig, setLayoutConfig,
    applyInlineStyle,
    applyFieldStyle,
    fitSinglePage,
    fieldStyles,
  };
}
