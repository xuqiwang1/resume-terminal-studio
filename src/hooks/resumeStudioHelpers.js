export const SECTION_LABELS = {
  header: "页眉",
  name: "姓名",
  title: "求职意向",
  contact: "联系方式",
  summary: "个人总结",
  education: "教育背景",
  experience: "实习经历",
  projects: "项目经历",
  skills: "专业技能"
};

export const FIELD_LABELS = {
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

const SECTION_ITEM_LABELS = {
  education: "教育经历",
  experience: "实习经历",
  projects: "项目经历",
  skills: "技能项"
};

const SECTION_FIELD_LABELS = {
  experience: {
    name: "公司",
    company: "公司",
    role: "岗位",
    date: "时间",
    details: "工作描述"
  },
  projects: {
    name: "项目名称",
    role: "角色",
    date: "时间",
    details: "项目描述"
  },
  education: {
    school: "学校",
    degree: "学历",
    major: "专业",
    date: "时间",
    tag: "标签"
  },
  skills: {
    category: "分类",
    content: "技能内容"
  },
  header: {
    name: "姓名",
    title: "求职意向",
    contact: "联系方式"
  },
  summary: {
    text: "正文"
  }
};

function fallbackLabel(value, fallback = "未命名字段") {
  return value ? String(value) : fallback;
}

export function formatSectionLabel(sectionId) {
  return SECTION_LABELS[sectionId] || fallbackLabel(sectionId, "整份文档");
}

export function formatFieldLabel(field, sectionId) {
  return SECTION_FIELD_LABELS[sectionId]?.[field] || FIELD_LABELS[field] || fallbackLabel(field);
}

export function formatItemPosition(index) {
  if (!Number.isInteger(index)) return "";
  return `第 ${index + 1} 条`;
}

export function formatFieldPathLabel(fid) {
  const { sectionId, index, field } = parseFieldId(fid);
  if (!sectionId) return "整份文档";
  const sectionLabel = formatSectionLabel(sectionId);
  const parts = [sectionLabel];
  const position = formatItemPosition(index);
  if (position) parts.push(position);
  if (field) parts.push(formatFieldLabel(field, sectionId));
  return parts.join(" / ");
}

export function formatSelectionSummary({ selectedField, activeSectionId } = {}) {
  if (selectedField) {
    return {
      title: `当前选中：${formatFieldPathLabel(selectedField)}`,
      description: "可调整选中字段的字体和颜色。"
    };
  }
  if (activeSectionId) {
    return {
      title: `当前范围：${formatSectionLabel(activeSectionId)}`,
      description: "可调整当前区块的布局和文档样式。"
    };
  }
  return {
    title: "当前范围：整份文档",
    description: "可调整全局字体、字号、密度和分隔线。"
  };
}

export function formatPendingChangeLabel(change = {}) {
  const sectionLabel = formatSectionLabel(change.sectionId);
  const itemLabel = SECTION_ITEM_LABELS[change.sectionId] || sectionLabel;
  const position = formatItemPosition(change.index);

  if (change.operation === "append_item") return `新增${itemLabel}`;
  if (change.operation === "replace_item") return `替换${itemLabel}${position ? position : ""}`;
  if (change.operation === "replace_section") return `改写${sectionLabel}`;
  if (change.operation === "replace_field") {
    const fieldLabel = formatFieldLabel(change.field, change.sectionId);
    if (!position) return `修改${sectionLabel}${change.field ? ` / ${fieldLabel}` : ""}`;
    return `修改${itemLabel}${position} / ${fieldLabel}`;
  }
  return `修改${sectionLabel}`;
}

export function formatPendingChangeFields(change = {}) {
  const value = change.after ?? change.value ?? change.before;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).map((field) => formatFieldLabel(field, change.sectionId));
  }
  if (change.field) return [formatFieldLabel(change.field, change.sectionId)];
  return [];
}

export function formatPendingValue(value, sectionId) {
  if (value == null) return [];
  if (typeof value === "string") {
    return [{ label: null, text: value }];
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      label: `第 ${index + 1} 条`,
      text: typeof item === "string" ? item : formatPendingValue(item, sectionId).map((entry) => {
        if (!entry.label) return entry.text;
        return `${entry.label}：${entry.text}`;
      }).join("\n")
    }));
  }
  if (typeof value === "object") {
    return Object.entries(value).map(([field, fieldValue]) => ({
      label: formatFieldLabel(field, sectionId),
      text: typeof fieldValue === "string" ? fieldValue : String(fieldValue ?? "")
    }));
  }
  return [{ label: null, text: String(value) }];
}

export function sectionIdFromFieldId(fid) {
  if (!fid) return null;
  const part = fid.split(".")[0];
  return part;
}

export function patchFieldId(sectionId, index) {
  if (sectionId === "summary") return "summary.text";
  if (sectionId === "experience") return `experience.${index ?? 0}.details`;
  if (sectionId === "projects") return `projects.${index ?? 0}.details`;
  if (sectionId === "name") return "header.name";
  if (sectionId === "title") return "header.title";
  if (sectionId === "contact") return "header.contact";
  return null;
}

export function normalizePendingSection(sectionId) {
  if (sectionId === "name" || sectionId === "title" || sectionId === "contact") return "header";
  return sectionId || null;
}

export function getPendingPatchPrimarySection(pending) {
  if (!pending) return null;
  if (pending.kind === "batch") {
    return normalizePendingSection(pending.changes?.[0]?.sectionId);
  }
  return normalizePendingSection(pending.sectionId);
}

export function describePendingPatch(pending) {
  if (!pending) return "AI 改动";
  if (pending.kind === "batch") {
    return pending.title || `批量改动（${pending.changes?.length || 0} 项）`;
  }
  return pending.sectionId || "AI 改动";
}

export function parseFieldId(fid) {
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

export function textForField(resume, fid) {
  const { sectionId, index, field } = parseFieldId(fid);
  if (!sectionId || !field) return "";
  if (sectionId === "summary") return resume.summary || "";
  if (sectionId === "header") return resume[field] || "";
  const arr = resume[sectionId];
  if (Array.isArray(arr) && arr[index]) return arr[index][field] || "";
  return "";
}
