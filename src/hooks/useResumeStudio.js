import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runBridgeAction } from "../lib/bridgeClient";
import { desktopSessionInfo } from "../lib/appClient";
import { toSegments, applyStyleToRange, toPlainText } from "../lib/richText";
import {
  fetchActiveResume,
  fetchActivityState,
  fetchBridgeHealth,
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

function sectionIdFromFieldId(fid) {
  if (!fid) return null;
  const part = fid.split(".")[0];
  if (part === "header") return "summary";
  return part;
}

function patchFieldId(sectionId, index) {
  if (sectionId === "summary") return "summary.text";
  if (sectionId === "experience") return `experience.${index ?? 0}.details`;
  if (sectionId === "projects") return `projects.${index ?? 0}.details`;
  if (sectionId === "title") return "header.title";
  if (sectionId === "contact") return "header.contact";
  return null;
}

function normalizePendingSection(sectionId) {
  if (sectionId === "title" || sectionId === "contact") return "summary";
  return sectionId || null;
}

function getPendingPatchPrimarySection(pending) {
  if (!pending) return null;
  if (pending.kind === "batch") {
    return normalizePendingSection(pending.changes?.[0]?.sectionId);
  }
  return normalizePendingSection(pending.sectionId);
}

function describePendingPatch(pending) {
  if (!pending) return "AI 改动";
  if (pending.kind === "batch") {
    return pending.title || `批量改动（${pending.changes?.length || 0} 项）`;
  }
  return pending.sectionId || "AI 改动";
}

function parseFieldId(fid) {
  if (!fid) return { sectionId: null, index: null, field: null };
  const parts = fid.split(".");
  if (parts[0] === "header") return { sectionId: "header", index: null, field: parts[1] || null };
  if (parts.length >= 3) {
    const parsedIndex = Number(parts[1]);
    return {
      sectionId: parts[0],
      index: Number.isInteger(parsedIndex) ? parsedIndex : null,
      field: parts[2] || null
    };
  }
  return { sectionId: parts[0] || null, index: null, field: parts[1] || null };
}

function textForField(resume, fid) {
  const { sectionId, index, field } = parseFieldId(fid);
  if (!sectionId || !field) return "";
  if (sectionId === "summary") return resume.summary || "";
  if (sectionId === "header") return resume[field] || "";
  const arr = resume[sectionId];
  if (Array.isArray(arr) && arr[index]) return arr[index][field] || "";
  return "";
}

const SECTION_LABELS = {
  header: "页眉",
  summary: "个人总结",
  education: "教育背景",
  experience: "实习经历",
  projects: "项目经历",
  skills: "专业技能"
};

const FIELD_LABELS = {
  name: "姓名",
  title: "求职意向",
  contact: "联系方式",
  school: "学校",
  degree: "学历",
  major: "专业",
  date: "时间",
  tag: "标签",
  company: "公司",
  role: "角色",
  details: "详情",
  category: "分类",
  content: "内容",
  text: "正文"
};

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
          terminalAgentPath: "",
          activityLogPath: "",
          session: desktopSession,
          runtimeReady: Boolean(desktopSession?.runtimeReady)
        })
      );

    fetchActiveResume()
      .then((data) => {
        const r = data.resume || initialResume;
        setResume(r);
        if (r.avatar !== undefined) setAvatarState(r.avatar ?? null);
        setFieldStyles(r.fieldStyles || {});
        prevResumeRef.current = r;
        initialLoadDone.current = true;
      })
      .catch(() => {
        prevResumeRef.current = initialResume;
        initialLoadDone.current = true;
      });

    fetchActivityState()
      .then((data) => setActivityState(data.state || {}))
      .catch(() => {});

    stopResumeStream = subscribeResumeUpdates((nextResume) => {
      // File watchers can emit several times for one disk write, and external
      // agents may write active-resume.json repeatedly while drafting. Treat the
      // stream as state sync only; patch animation is driven by explicit patch
      // events/confirm actions so it cannot replay in a loop.
      prevResumeRef.current = nextResume;
      setResume(nextResume);
      setFieldStyles(nextResume?.fieldStyles || {});
      if (nextResume && nextResume.avatar !== undefined) {
        setAvatarState(nextResume.avatar ?? null);
      }
    });

    stopActivityStream = subscribeActivityUpdates({
      state: (payload) => {
        setActivityState(payload.state || {});
      },
      activity: ({ event, state }) => {
        setActivityState(state || {});
        if (event.type === "command:start") {
          setActivityItems((current) => [
            {
              label: "Terminal",
              state: "Started",
              text: `在本机终端执行：resume-agent ${[event.command, ...(event.args || [])].join(" ")}`
            },
            ...current
          ]);
        }
        if (event.type === "stdout") {
          setActivityItems((current) => [
            {
              label: "stdout",
              state: "Running",
              text: event.text
            },
            ...current
          ]);
        }
        if (event.type === "intent") {
          setWorkingSection(
            event.target === "title" || event.target === "contact" ? "summary" : event.target
          );
          setActivityItems((current) => [
            {
              label: "Intent",
              state: "Parsed",
              text: `已解析意图：${event.instruction} → ${event.target}`
            },
            ...current
          ]);
        }
        if (event.type === "stderr") {
          setActivityItems((current) => [
            {
              label: "stderr",
              state: "Error",
              text: event.text
            },
            ...current
          ]);
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
  }, []);

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
          setActivityItems((current) => [payload, ...current]);
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
          setResume(payload);
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
      if (result?.resume) {
        prevResumeRef.current = result.resume;
        setResume(result.resume);
        setFieldStyles(result.resume?.fieldStyles || {});
        if (result.resume.avatar !== undefined) {
          setAvatarState(result.resume.avatar ?? null);
        }
      }
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
      setActivityItems((current) => [
        {
          label: "Patch",
          state: "Confirmed",
          text: `已接受 AI 改动并写入${describePendingPatch(pendingPatch)}。`
        },
        ...current
      ]);
    } catch (e) {
      setActivityItems((current) => [
        { label: "Patch", state: "Error", text: `确认失败：${e.message}` },
        ...current
      ]);
    }
  }, [pendingPatch]);

  const rejectPending = useCallback(async () => {
    if (!pendingPatch) return;
    setWorkingSection(null);
    try {
      await rejectPendingPatch(pendingPatch.id);
      setActivityItems((current) => [
        { label: "Patch", state: "Rejected", text: "已拒绝本次 AI 改动，简历未改变。" },
        ...current
      ]);
    } catch (e) {
      setActivityItems((current) => [
        { label: "Patch", state: "Error", text: `拒绝失败：${e.message}` },
        ...current
      ]);
    }
  }, [pendingPatch]);

  const saveCurrentResume = async () => {
    try {
      const saved = await saveResumeToFile({
        resume,
        fileName: currentFileName || `${resume.name || "resume"}-studio`
      });
      setCurrentFileName(saved.fileName);
      syncContextDocument({
        mode: "file",
        fileName: saved.fileName,
        historyFileName: "",
        title: saved.document?.meta?.title || saved.fileName
      }).catch(() => {});
      await refreshFiles();
      setActivityItems((current) => [
        {
          label: "File",
          state: "Saved",
          text: `已保存到本地文件：${saved.fileName}`
        },
        ...current
      ]);
    } catch (e) {
      setActivityItems((current) => [
        {
          label: "File",
          state: "Error",
          text: `保存失败：${e.message}`
        },
        ...current
      ]);
      throw e;
    }
  };

  const openLatestResume = async () => {
    const latest = recentFiles[0];
    if (!latest) return;
    const opened = await openResumeFile(latest.fileName);
    setResume(opened.document.resume);
    if (opened.document.resume?.avatar !== undefined) {
      setAvatarState(opened.document.resume.avatar ?? null);
    }
    setFieldStyles(opened.document.resume?.fieldStyles || {});
    setCurrentFileName(opened.fileName);
    syncContextDocument({
      mode: "file",
      fileName: opened.fileName,
      historyFileName: "",
      title: opened.document?.meta?.title || opened.fileName
    }).catch(() => {});
    setActivityItems((current) => [
      {
        label: "File",
        state: "Opened",
        text: `已打开本地文件：${opened.fileName}`
      },
      ...current
    ]);
  };

  const archiveCurrent = async () => {
    const saved = await archiveCurrentResume("manual-snapshot");
    await refreshHistory();
    setActivityItems((current) => [
      {
        label: "History",
        state: "Archived",
        text: `已保存历史版本：${saved.archive?.fileName || "snapshot"}`
      },
      ...current
    ]);
  };

  const startNewResume = async () => {
    const created = await createNewResume("new-template");
    const nextResume = created.resume;
    prevResumeRef.current = nextResume;
    setResume(nextResume);
    setFieldStyles(nextResume?.fieldStyles || {});
    setAvatarState(nextResume?.avatar ?? null);
    setCurrentFileName("");
    setDiff({ before: "", after: "" });
    setPatchAnimation(null);
    setActiveSectionId("education");
    syncContextDocument({
      mode: "template",
      fileName: "",
      historyFileName: "",
      title: `${nextResume.name || "Your Name"}-resume`
    }).catch(() => {});
    await refreshHistory();
    setActivityItems((current) => [
      {
        label: "History",
        state: "New Template",
        text: `已归档当前简历，并打开新的空白模板。`
      },
      ...current
    ]);
  };

  const openArchive = async (fileName) => {
    const opened = await openResumeArchive(fileName);
    const nextResume = opened.resume;
    prevResumeRef.current = nextResume;
    setResume(nextResume);
    setFieldStyles(nextResume?.fieldStyles || {});
    setAvatarState(nextResume?.avatar ?? null);
    setCurrentFileName("");
    setDiff({ before: "", after: "" });
    setPatchAnimation(null);
    syncContextDocument({
      mode: "history",
      fileName: "",
      historyFileName: fileName,
      title: fileName
    }).catch(() => {});
    await refreshHistory();
    setActivityItems((current) => [
      {
        label: "History",
        state: "Restored",
        text: `已从历史版本恢复：${fileName}`
      },
      ...current
    ]);
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
