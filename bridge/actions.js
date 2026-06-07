export const actionCatalog = {
  jd: {
    command:
      "printf '$ resume-agent tailor --source ./resume.json --jd ./jd.txt\\n'; sleep 1; printf '[1/5] 读取岗位描述 ...\\n'; sleep 1; printf '[2/5] 提取关键词：AI workflow / product sense / execution visibility\\n'; sleep 1; printf '[3/5] 匹配个人总结与项目经历 ...\\n'; sleep 1; printf '[4/5] 生成替换 patch -> section: summary\\n'; sleep 1; printf '[5/5] 写回 resume.json 并刷新预览\\n'; sleep 1; printf '✓ Done\\n'",
    patch(resume) {
      return {
        sectionId: "summary",
        field: "summary",
        before: resume.summary,
        after:
          "面向 AI 工作流与产品设计岗位，擅长把复杂流程拆解成可执行路径，并通过终端联动、过程可视化和结构化输出提升系统可信度。"
      };
    },
    activityMap: {
      "$ resume-agent tailor --source ./resume.json --jd ./jd.txt": {
        label: "Command",
        state: "Started",
        text: "已在本机终端发起 tailor 命令，开始读取当前简历和岗位描述。"
      },
      "[1/5] 读取岗位描述 ...": {
        label: "Step 1",
        state: "Running",
        text: "正在读取岗位描述，并提取本次投递最关键的关键词。"
      },
      "[2/5] 提取关键词：AI workflow / product sense / execution visibility": {
        label: "Step 2",
        state: "Running",
        text: "已识别出 AI workflow、产品判断和执行透明度等重点表达。"
      },
      "[3/5] 匹配个人总结与项目经历 ...": {
        label: "Step 3",
        state: "Running",
        text: "正在定位最适合被更新的 section，并优先改写个人总结。"
      },
      "[4/5] 生成替换 patch -> section: summary": {
        label: "Patch",
        state: "Patched",
        text: "已生成一份新的 summary patch，主预览正在同步变化。",
        sectionId: "summary",
        emitPatch: true
      },
      "[5/5] 写回 resume.json 并刷新预览": {
        label: "Preview",
        state: "Synced",
        text: "新的文案已写回数据层，A4 简历预览已实时刷新。"
      },
      "✓ Done": {
        label: "Result",
        state: "Done",
        text: "本次根据 JD 的定向优化已完成。",
        done: true
      }
    }
  },
  summary: {
    command:
      "printf '$ resume-agent rewrite-summary --resume ./resume.json\\n'; sleep 1; printf 'Loading active resume...\\n'; sleep 1; printf 'Opening local terminal session...\\n'; sleep 1; printf 'Rewriting summary with tighter product language...\\n'; sleep 1; printf 'Patch applied to summary\\n'",
    patch(resume) {
      return {
        sectionId: "summary",
        field: "summary",
        before: resume.summary,
        after:
          "希望持续探索 AI 驱动产品中的透明执行体验，擅长把抽象需求转成清晰的信息架构、交互路径与可交付原型。"
      };
    },
    activityMap: {
      "$ resume-agent rewrite-summary --resume ./resume.json": {
        label: "Command",
        state: "Started",
        text: "已在本机终端启动 summary 改写命令。"
      },
      "Loading active resume...": {
        label: "Load",
        state: "Running",
        text: "正在载入当前活动简历。"
      },
      "Opening local terminal session...": {
        label: "Session",
        state: "Running",
        text: "终端会话已建立，准备执行文案收紧。"
      },
      "Rewriting summary with tighter product language...": {
        label: "Rewrite",
        state: "Editing",
        text: "正在把个人总结改成更像产品工作流方向的表达。",
        sectionId: "summary"
      },
      "Patch applied to summary": {
        label: "Patch",
        state: "Done",
        text: "新的 summary patch 已应用，主预览已经同步变化。",
        sectionId: "summary",
        emitPatch: true,
        done: true
      }
    }
  },
  experience: {
    command:
      "printf '$ resume-agent rewrite-experience --section experience[0]\\n'; sleep 1; printf 'Selecting experience[0]...\\n'; sleep 1; printf 'Generating stronger outcome-oriented phrasing...\\n'; sleep 1; printf 'Updating preview cache...\\n'; sleep 1; printf '✓ Experience section updated\\n'",
    patch(resume) {
      return {
        sectionId: "experience",
        field: "details",
        index: 0,
        before: resume.experience[0].details,
        after:
          "参与 AI 辅助写作与数据工作流产品设计，负责需求拆解、交互策略与原型输出，并推动多轮体验验证与方案收敛。"
      };
    },
    activityMap: {
      "$ resume-agent rewrite-experience --section experience[0]": {
        label: "Command",
        state: "Started",
        text: "已在终端中选中第一段工作经历，准备进行强化改写。"
      },
      "Selecting experience[0]...": {
        label: "Select",
        state: "Running",
        text: "正在定位 experience[0] 的原始内容。"
      },
      "Generating stronger outcome-oriented phrasing...": {
        label: "Rewrite",
        state: "Editing",
        text: "正在把经历改成更强调结果导向的产品表达。",
        sectionId: "experience"
      },
      "Updating preview cache...": {
        label: "Preview",
        state: "Syncing",
        text: "工作经历 patch 已生成，预览正在同步刷新。",
        sectionId: "experience",
        emitPatch: true
      },
      "✓ Experience section updated": {
        label: "Result",
        state: "Done",
        text: "工作经历更新完成。",
        done: true
      }
    }
  },
  pdf: {
    command:
      "printf '$ resume-agent export-pdf --resume ./resume.json --out ~/Desktop/resume.pdf\\n'; sleep 1; printf 'Rendering A4 preview...\\n'; sleep 1; printf 'Launching PDF renderer...\\n'; sleep 1; printf 'Writing file -> /Users/xuqiwang/Desktop/resume.pdf\\n'; sleep 1; printf '✓ PDF exported successfully\\n'",
    patch() {
      return null;
    },
    activityMap: {
      "$ resume-agent export-pdf --resume ./resume.json --out ~/Desktop/resume.pdf": {
        label: "Command",
        state: "Started",
        text: "已在本机终端启动 PDF 导出命令。"
      },
      "Rendering A4 preview...": {
        label: "Render",
        state: "Running",
        text: "正在渲染当前 A4 预览。"
      },
      "Launching PDF renderer...": {
        label: "Renderer",
        state: "Running",
        text: "PDF 渲染器已启动。"
      },
      "Writing file -> /Users/xuqiwang/Desktop/resume.pdf": {
        label: "Write",
        state: "Exporting",
        text: "正在把投递版 PDF 写入桌面路径。"
      },
      "✓ PDF exported successfully": {
        label: "Result",
        state: "Done",
        text: "PDF 已成功导出。",
        done: true
      }
    }
  }
};

/**
 * Fine-grained patch applicator.
 * Supports: sectionId + optional index + optional field.
 * Falls back to legacy behavior for backward compatibility.
 */
export function applyPatchToResume(resume, patch) {
  if (!patch) return resume;

  if (patch.sectionId === "summary") {
    return { ...resume, summary: patch.after };
  }

  if (patch.sectionId === "title") {
    return { ...resume, title: patch.after };
  }

  if (patch.sectionId === "contact") {
    return { ...resume, contact: patch.after };
  }

  if (patch.sectionId === "experience") {
    const targetIndex = patch.index ?? 0;
    const targetField = patch.field || "details";
    return {
      ...resume,
      experience: resume.experience.map((item, i) => {
        if (i !== targetIndex) return item;
        if (typeof patch.bulletIndex === "number" && targetField === "details") {
          const lines = (item[targetField] || "").split("\n");
          if (patch.bulletIndex >= lines.length) {
            lines.push(patch.after);
          } else {
            lines[patch.bulletIndex] = patch.after;
          }
          return { ...item, [targetField]: lines.join("\n") };
        }
        return { ...item, [targetField]: patch.after };
      })
    };
  }

  if (patch.sectionId === "projects") {
    const targetIndex = patch.index ?? 0;
    const targetField = patch.field || "details";
    return {
      ...resume,
      projects: resume.projects.map((item, i) => {
        if (i !== targetIndex) return item;
        if (typeof patch.bulletIndex === "number" && targetField === "details") {
          const lines = (item[targetField] || "").split("\n");
          if (patch.bulletIndex >= lines.length) {
            lines.push(patch.after);
          } else {
            lines[patch.bulletIndex] = patch.after;
          }
          return { ...item, [targetField]: lines.join("\n") };
        }
        return { ...item, [targetField]: patch.after };
      })
    };
  }

  if (patch.sectionId === "education" || patch.sectionId === "skills") {
    const sectionId = patch.sectionId;
    const targetIndex = patch.index ?? 0;
    const defaultField = sectionId === "education" ? "school" : "content";
    const targetField = patch.field || defaultField;
    const emptyItem =
      sectionId === "education"
        ? { school: "", degree: "", major: "", date: "", tag: "" }
        : { category: "", content: "" };
    const arr = Array.isArray(resume[sectionId]) ? resume[sectionId] : [];
    if (patch.append) {
      return {
        ...resume,
        [sectionId]: [...arr, { ...emptyItem, [targetField]: patch.after }]
      };
    }
    return {
      ...resume,
      [sectionId]: arr.map((item, i) =>
        i === targetIndex ? { ...item, [targetField]: patch.after } : item
      )
    };
  }

  return resume;
}
