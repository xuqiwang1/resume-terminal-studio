import TopBar from "./components/TopBar";
import LeftStylePanel from "./components/LeftStylePanel";
import ResumePreview from "./components/ResumePreview";
import PrintView from "./components/PrintView";
import PendingPatchBanner from "./components/PendingPatchBanner";
import HistoryPanel from "./components/HistoryPanel";
import { useResumeStudio } from "./hooks/useResumeStudio";
import { useTextSelection } from "./hooks/useTextSelection";
import { exportPdf, isDesktopApp } from "./lib/fileClient";
import { A4_PAGE_HEIGHT_PX, A4_OVERFLOW_TOLERANCE_PX } from "./lib/a4Page";
import { formatSectionOverflow } from "./lib/sectionOverflow";
import { useCallback, useEffect, useRef, useState } from "react";

export default function App() {
  const desktop = isDesktopApp();
  const resumePageRef = useRef(null);
  const printPageRef = useRef(null);
  const [autoFit, setAutoFit] = useState(true);
  const [adaptiveStyle, setAdaptiveStyle] = useState(null);
  const [overflowReport, setOverflowReport] = useState({ overflowAmount: 0, sections: [] });
  const handleOverflowChange = useCallback((report) => setOverflowReport(report), []);
  const textSelection = useTextSelection(resumePageRef);
  const {
    resume, activeSectionId, flashToken,
    bridgeStatus, currentFileName,
    saveCurrentResume, openLatestResume,
    resumeArchives, historyPanelOpen, setHistoryPanelOpen,
    archiveCurrent, startNewResume, openArchive,
    selectedField, onSelectField, workingSection,
    syncView,
    pendingPatch, pendingConflicts, confirmPending, rejectPending,
    patchAnimation, onPatchAnimationComplete,
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
    updateFieldText,
    fieldStyles,
  } = useResumeStudio();

  const handleExportPdf = async () => {
    const target = printPageRef.current || resumePageRef.current;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const exportHeight = target?.scrollHeight || 0;
    if (exportHeight > A4_PAGE_HEIGHT_PX + A4_OVERFLOW_TOLERANCE_PX) {
      const overflow = Math.ceil(exportHeight - A4_PAGE_HEIGHT_PX);
      // Name the sections responsible: "too long by 32px" is not actionable on its own.
      const culprits = formatSectionOverflow(overflowReport.sections, 4);
      const error = new Error(
        culprits
          ? `当前内容超出 A4 约 ${overflow}px（${culprits}），请删减这些部分或手动降低密度后再导出。`
          : `当前内容超出 A4 约 ${overflow}px，请删减内容或手动降低密度后再导出。`
      );
      error.name = "ExportPreflightError";
      throw error;
    }
    return exportPdf();
  };

  useEffect(() => {
    window.resumeStudioDebug = {
      fitAndMeasure: async () => {
        const target = printPageRef.current || resumePageRef.current;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const finalTarget = printPageRef.current || resumePageRef.current;
        const scrollHeight = finalTarget?.scrollHeight || 0;
        return {
          fitsA4: scrollHeight <= A4_PAGE_HEIGHT_PX + A4_OVERFLOW_TOLERANCE_PX,
          scrollHeight,
          overflow: Math.max(0, Math.ceil(scrollHeight - A4_PAGE_HEIGHT_PX)),
          overflowSections: overflowReport.sections,
          clientHeight: finalTarget?.clientHeight || 0,
          width: finalTarget?.getBoundingClientRect().width || 0,
          height: finalTarget?.getBoundingClientRect().height || 0,
          rules: {
            preview: (() => {
              const el = document.querySelector(".resume-canvas .pro-rule");
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              return { height: rect.height, computedHeight: getComputedStyle(el).height };
            })(),
            print: (() => {
              const el = document.querySelector(".print-page .pro-rule");
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              return { height: rect.height, computedHeight: getComputedStyle(el).height };
            })()
          }
        };
      }
    };
    return () => {
      delete window.resumeStudioDebug;
    };
  }, [overflowReport]);

  return (
    <div className="app-shell">
      <TopBar
        onSave={saveCurrentResume}
        onOpenLatest={openLatestResume}
        onOpenHistory={() => setHistoryPanelOpen(true)}
        onNewResume={startNewResume}
        bridgeStatus={bridgeStatus}
        currentFileName={currentFileName}
        isDesktop={desktop}
        onExportPdf={handleExportPdf}
      />

      <main className="workspace" id="workspace">
        <LeftStylePanel
          templateId={templateId} onChangeTemplate={setTemplateId}
          fontId={fontId} onFontChange={setFontId}
          colorId={colorId} onColorChange={setColorId}
          lineHeight={lineHeight} onLineHeightChange={setLineHeight}
          sectionGap={sectionGap} onSectionGapChange={setSectionGap}
          pagePadding={pagePadding} onPaddingChange={setPagePadding}
          fontSize={fontSize} onFontSizeChange={setFontSize}
          ruleStyle={ruleStyle} onRuleStyleChange={setRuleStyle}
          avatar={avatar} onAvatarChange={setAvatar}
          layoutConfig={layoutConfig} onLayoutConfigChange={setLayoutConfig}
          textSelection={textSelection}
          selectedField={selectedField}
          activeSectionId={activeSectionId}
          resume={resume}
          onUpdateFieldText={updateFieldText}
          onApplyInlineStyle={applyInlineStyle}
          onApplyFieldStyle={applyFieldStyle}
        />
        <ResumePreview
          ref={resumePageRef}
          resume={resume}
          activeSectionId={activeSectionId}
          flashToken={flashToken}
          selectedField={selectedField}
          onSelectField={onSelectField}
          workingSection={workingSection}
          patchAnimation={patchAnimation}
          onPatchAnimationComplete={onPatchAnimationComplete}
          templateId={templateId}
          fontId={fontId}
          colorId={colorId}
          lineHeight={lineHeight}
          sectionGap={sectionGap}
          pagePadding={pagePadding}
          fontSize={fontSize}
          ruleStyle={ruleStyle}
          avatar={avatar}
          avatarPos={avatarPos}
          onAvatarPosChange={setAvatarPos}
          layoutConfig={layoutConfig}
          fieldStyles={fieldStyles}
          autoFit={autoFit}
          adaptiveStyle={adaptiveStyle}
          onAutoFitChange={setAutoFit}
          onAdaptiveStyleChange={setAdaptiveStyle}
          onOverflowChange={handleOverflowChange}
          onViewChange={syncView}
        />
      </main>

      <PendingPatchBanner
        pending={pendingPatch}
        conflicts={pendingConflicts}
        onConfirm={confirmPending}
        onReject={rejectPending}
      />

      <HistoryPanel
        open={historyPanelOpen}
        archives={resumeArchives}
        onClose={() => setHistoryPanelOpen(false)}
        onArchive={archiveCurrent}
        onOpenArchive={openArchive}
      />

      <PrintView
        ref={printPageRef}
        resume={resume}
        templateId={templateId}
        fontId={fontId}
        colorId={colorId}
        lineHeight={lineHeight}
        sectionGap={sectionGap}
        pagePadding={pagePadding}
        fontSize={fontSize}
        ruleStyle={ruleStyle}
        avatar={avatar}
        avatarPos={avatarPos}
        layoutConfig={layoutConfig}
        fieldStyles={fieldStyles}
        adaptiveStyle={autoFit ? adaptiveStyle : null}
      />
    </div>
  );
}
