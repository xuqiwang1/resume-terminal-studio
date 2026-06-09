export const SECTION_LABELS = {
  header: "页眉",
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

export function sectionIdFromFieldId(fid) {
  if (!fid) return null;
  const part = fid.split(".")[0];
  if (part === "header") return "summary";
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
  if (sectionId === "name" || sectionId === "title" || sectionId === "contact") return "summary";
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
