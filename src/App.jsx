import TopBar from "./components/TopBar";
import LeftStylePanel from "./components/LeftStylePanel";
import ResumePreview from "./components/ResumePreview";
import PrintView from "./components/PrintView";
import PendingPatchBanner from "./components/PendingPatchBanner";
import HistoryPanel from "./components/HistoryPanel";
import { useResumeStudio } from "./hooks/useResumeStudio";
import { useTextSelection } from "./hooks/useTextSelection";
import { exportPdf, isDesktopApp } from "./lib/fileClient";
import { useEffect, useRef } from "react";

export default function App() {
  const desktop = isDesktopApp();
  const resumePageRef = useRef(null);
  const printPageRef = useRef(null);
  const textSelection = useTextSelection(resumePageRef);
  const {
    resume, activeSectionId, flashToken, draftState,
    runAction, bridgeStatus, currentFileName,
    saveCurrentResume, openLatestResume,
    resumeArchives, historyPanelOpen, setHistoryPanelOpen,
    archiveCurrent, startNewResume, openArchive,
    selectedField, onSelectField, workingSection,
    syncView,
    pendingPatch, confirmPending, rejectPending,
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
    fitSinglePage,
    fieldStyles,
  } = useResumeStudio();

  const handleExportPdf = async () => {
    await fitSinglePage(() => printPageRef.current || resumePageRef.current);
    return exportPdf();
  };

  useEffect(() => {
    window.resumeStudioDebug = {
      fitAndMeasure: async () => {
        const target = printPageRef.current || resumePageRef.current;
        const before = target?.scrollHeight || 0;
        let fit = await fitSinglePage(() => printPageRef.current || resumePageRef.current);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        let finalTarget = printPageRef.current || resumePageRef.current;
        let after = finalTarget?.scrollHeight || 0;
        if (after > 1125) {
          fit = await fitSinglePage(() => printPageRef.current || resumePageRef.current);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          finalTarget = printPageRef.current || resumePageRef.current;
          after = finalTarget?.scrollHeight || 0;
        }
        return {
          fit,
          before,
          after,
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
  }, [fitSinglePage]);

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
          onApplyInlineStyle={applyInlineStyle}
          onApplyFieldStyle={applyFieldStyle}
        />
        <ResumePreview
          ref={resumePageRef}
          resume={resume}
          activeSectionId={activeSectionId}
          flashToken={flashToken}
          draftState={draftState}
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
          onViewChange={syncView}
        />
      </main>

      <PendingPatchBanner
        pending={pendingPatch}
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
      />
    </div>
  );
}
