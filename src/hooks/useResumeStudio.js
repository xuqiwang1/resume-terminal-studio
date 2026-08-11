import { useCallback, useEffect, useRef, useState } from "react";
import { desktopSessionInfo } from "../lib/appClient";
import { toSegments, applyStyleToRange } from "../lib/richText";
import {
  describePendingPatch,
  FIELD_LABELS,
  getPendingPatchPrimarySection,
  normalizePendingSection,
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
  saveStyleSettings,
  subscribeActivityUpdates,
  subscribeResumeUpdates,
  subscribePendingUpdates,
  confirmPendingPatch,
  rejectPendingPatch,
  syncContextDocument,
  syncContextSelection,
  syncContextView,
} from "../lib/fileClient";
import { initialActivity, initialResume } from "../data/mockResume";
import { mergeResumeSnapshot } from "./resumeSnapshotMerge";
import { getTemplate } from "../templates/registry";
import {
  applyTemplatePreset,
  normalizeStyleSettings,
  styleSettingsEqual
} from "../lib/styleSettings";

const STYLE_AUTOSAVE_DELAY_MS = 400;

const DEFAULT_LAYOUT_CONFIG = {
  education: { schoolAlign: "center", majorAlign: "right" },
  skills: { layout: "block" },
  linkStyle: { mode: "default", color: "#0645ad", underline: true }
};

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
  const [flashToken, setFlashToken] = useState(null);
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
  const [pendingConflicts, setPendingConflicts] = useState([]);
  const [patchAnimation, setPatchAnimation] = useState(null);
  // One object instead of eight independent states: presentation now lives inside the
  // resume document, so it is saved, restored, and archived along with the content.
  const [styleSettings, setStyleSettingsState] = useState(() =>
    normalizeStyleSettings(initialResume.styleSettings)
  );
  const [avatar, setAvatarState] = useState(initialResume.avatar ?? null);
  const [avatarPos, setAvatarPosState] = useState(initialResume.avatarPos || { x: 0, y: 0 });
  const [fieldStyles, setFieldStyles] = useState(initialResume.fieldStyles || {});
  const [layoutConfig, setLayoutConfigState] = useState(initialResume.layoutConfig || DEFAULT_LAYOUT_CONFIG);

  // Keep avatar in the persisted resume object so it survives save/load and is
  // consistent across templates that read resume.avatar. Avatar is uploaded in
  // the workbench (not via agent propose_edit).
  const setAvatar = useCallback((value) => {
    const next = value ?? null;
    setAvatarState(next);
    setResume((prev) => ({ ...prev, avatar: next }));
  }, []);

  const setAvatarPos = useCallback((value) => {
    const next = value || { x: 0, y: 0 };
    setAvatarPosState(next);
    setResume((prev) => ({ ...prev, avatarPos: next }));
  }, []);

  const setLayoutConfig = useCallback((value) => {
    const next = value || DEFAULT_LAYOUT_CONFIG;
    setLayoutConfigState(next);
    setResume((prev) => ({ ...prev, layoutConfig: next }));
  }, []);

  // Mirror style settings into the resume object. /api/patch/confirm hydrates the
  // server from the client's resume, so anything living outside it would be wiped
  // to undefined the moment an AI patch is accepted.
  const setStyleSettings = useCallback((updater) => {
    setStyleSettingsState((current) => {
      const raw = typeof updater === "function" ? updater(current) : updater;
      const next = normalizeStyleSettings(raw);
      if (styleSettingsEqual(current, next)) return current;
      setResume((prev) => ({ ...prev, styleSettings: next }));
      return next;
    });
  }, []);

  const patchStyle = useCallback(
    (partial) => setStyleSettings((current) => ({ ...current, ...partial })),
    [setStyleSettings]
  );

  const setTemplateId = useCallback((nextId) => {
    const nextTemplate = getTemplate(nextId);
    setStyleSettings((current) =>
      nextTemplate.id === current.templateId ? current : applyTemplatePreset(current, nextTemplate.id)
    );
  }, [setStyleSettings]);

  // Same public setter names the panel already binds to, so LeftStylePanel and App
  // do not need to know that these values became one object.
  const setFontId = useCallback((value) => patchStyle({ fontId: value }), [patchStyle]);
  const setColorId = useCallback((value) => patchStyle({ colorId: value }), [patchStyle]);
  const setLineHeight = useCallback((value) => patchStyle({ lineHeight: value }), [patchStyle]);
  const setSectionGap = useCallback((value) => patchStyle({ sectionGap: value }), [patchStyle]);
  const setPagePadding = useCallback((value) => patchStyle({ pagePadding: value }), [patchStyle]);
  const setFontSize = useCallback((value) => patchStyle({ fontSize: value }), [patchStyle]);
  const setRuleStyle = useCallback((value) => patchStyle({ ruleStyle: value }), [patchStyle]);

  const prevResumeRef = useRef(null);
  const resumeRef = useRef(initialResume);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    resumeRef.current = resume;
  }, [resume]);

  const pushActivityItem = useCallback((item) => {
    setActivityItems((current) => [item, ...current]);
  }, []);

  const applyResumeSnapshot = useCallback((nextResume, options = {}) => {
    const { updatePrevious = false } = options;
    const mergedResume = mergeResumeSnapshot(resumeRef.current, nextResume);
    if (updatePrevious) {
      prevResumeRef.current = mergedResume;
    }
    setResume(mergedResume);
    setFieldStyles(mergedResume?.fieldStyles || {});
    setLayoutConfigState(mergedResume?.layoutConfig || DEFAULT_LAYOUT_CONFIG);
    setStyleSettingsState(normalizeStyleSettings(mergedResume?.styleSettings));
    setAvatarPosState(mergedResume?.avatarPos || { x: 0, y: 0 });
    if (mergedResume && mergedResume.avatar !== undefined) {
      setAvatarState(mergedResume.avatar ?? null);
    }
  }, []);

  const syncDocumentState = useCallback((document) => {
    return syncContextDocument(document);
  }, []);

  const onSelectField = useCallback((fid) => {
    setSelectedField(fid);
    const parsed = parseFieldId(fid);
    const sectionId = parsed.sectionId || sectionIdFromFieldId(fid);
    if (sectionId) setActiveSectionId(sectionId);
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
      .then((data) => {
        setPendingPatch(data.pending || null);
        setPendingConflicts(data.conflicts || []);
      })
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
          setWorkingSection(normalizePendingSection(event.target));
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
          const resolvedSection = normalizePendingSection(event.sectionId);
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

    stopPendingStream = subscribePendingUpdates((pending, conflicts) => {
      setPendingPatch(pending);
      setPendingConflicts(conflicts || []);
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

  // Debounced style autosave. Sliders fire on every pointer move, so writing on each
  // change would thrash the disk; 400ms after the user stops, the settings are
  // persisted on their own endpoint. lastSavedStyleRef is what stops the
  // save -> broadcast -> snapshot -> save feedback loop.
  const lastSavedStyleRef = useRef(null);
  useEffect(() => {
    if (!initialLoadDone.current) return undefined;
    if (lastSavedStyleRef.current && styleSettingsEqual(lastSavedStyleRef.current, styleSettings)) {
      return undefined;
    }
    const timer = setTimeout(() => {
      lastSavedStyleRef.current = styleSettings;
      saveStyleSettings(styleSettings).catch((e) => {
        lastSavedStyleRef.current = null;
        pushActivityItem({ label: "Style", state: "Error", text: `样式自动保存失败：${e.message}` });
      });
    }, STYLE_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pushActivityItem, styleSettings]);

  // `force` is the user answering the conflict warning: they saw that the target text
  // changed after the patch was proposed and chose to overwrite it anyway.
  const confirmPending = useCallback(async ({ force = false } = {}) => {
    if (!pendingPatch) return;
    setWorkingSection(null);
    try {
      const result = await confirmPendingPatch(pendingPatch.id, resume, { allowConflict: force });
      setPendingConflicts([]);
      if (result?.resume) applyResumeSnapshot(result.resume, { updatePrevious: true });
      if (pendingPatch.kind !== "batch") {
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
        text: `已接受 AI 改动并写入${describePendingPatch(pendingPatch)}。已自动保存改动前的历史版本${
          result?.checkpoint?.fileName ? `：${result.checkpoint.fileName}` : ""
        }。`
      });
    } catch (e) {
      if (e.name === "PendingPatchConflict") {
        setPendingConflicts(e.conflicts);
        pushActivityItem({
          label: "Patch",
          state: "Conflict",
          text: `该改动的原文已被修改过（${e.conflicts.length} 处），未写入。请在审阅区确认后再接受。`
        });
        return;
      }
      pushActivityItem({ label: "Patch", state: "Error", text: `确认失败：${e.message}` });
    }
  }, [applyResumeSnapshot, pendingPatch, pushActivityItem, resume]);

  const rejectPending = useCallback(async () => {
    if (!pendingPatch) return;
    setWorkingSection(null);
    try {
      await rejectPendingPatch(pendingPatch.id);
      setPendingConflicts([]);
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
    setPatchAnimation(null);
    setPendingPatch(null);
    await refreshHistory();
    pushActivityItem({
      label: "History",
      state: "Restored",
      text: `已从历史版本恢复：${fileName}`
    });
  };

  return {
    resume,
    activeSectionId,
    setActiveSectionId,
    activityItems,
    flashToken,
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
    activityState,
    selectedField,
    onSelectField,
    syncView,
    workingSection,
    pendingPatch,
    pendingConflicts,
    confirmPending,
    rejectPending,
    patchAnimation,
    onPatchAnimationComplete,
    templateId: styleSettings.templateId, setTemplateId,
    fontId: styleSettings.fontId, setFontId,
    colorId: styleSettings.colorId, setColorId,
    lineHeight: styleSettings.lineHeight, setLineHeight,
    sectionGap: styleSettings.sectionGap, setSectionGap,
    pagePadding: styleSettings.pagePadding, setPagePadding,
    fontSize: styleSettings.fontSize, setFontSize,
    ruleStyle: styleSettings.ruleStyle, setRuleStyle,
    styleSettings,
    avatar, setAvatar,
    avatarPos, setAvatarPos,
    layoutConfig, setLayoutConfig,
    applyInlineStyle,
    applyFieldStyle,
    fieldStyles,
  };
}
