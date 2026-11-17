export function fieldId(sectionId, index, field) {
  if (index != null) return `${sectionId}.${index}.${field}`;
  return `${sectionId}.${field}`;
}

export function isSelected(selectedField, sectionId, index, field) {
  if (!selectedField) return false;
  return selectedField === fieldId(sectionId, index, field);
}

export function sectionClass(activeSectionId, workingSection, id) {
  const classes = ["resume-section"];
  if (activeSectionId === id) classes.push("active-section");
  if (workingSection === id) classes.push("working-section");
  return classes.join(" ");
}

export function fieldClass(selectedField, sectionId, index, field) {
  const classes = ["resume-field"];
  if (isSelected(selectedField, sectionId, index, field)) classes.push("field-selected");
  return classes.join(" ");
}

export const ALL_SECTIONS = ["summary", "skills", "experience", "projects", "education"];

export const SECTION_NAMES = {
  summary: "个人总结",
  skills: "专业技能",
  experience: "工作经历",
  projects: "项目经历",
  education: "教育背景"
};

export function resolveSectionOrder(layoutConfig, defaultOrder = ALL_SECTIONS) {
  const configured = Array.isArray(layoutConfig?.sectionOrder) ? layoutConfig.sectionOrder : defaultOrder;
  const filtered = configured.filter((s) => ALL_SECTIONS.includes(s));
  const missing = ALL_SECTIONS.filter((s) => !filtered.includes(s));
  return [...filtered, ...missing];
}

export function linkStyleForField(fieldStyles = {}, fid) {
  const style = fieldStyles[fid] || {};
  return {
    "--r-link-color": style.linkColor || undefined,
    "--r-link-decoration": style.linkUnderline === false ? "none" : undefined,
  };
}

export function mergeFieldStyle(fieldStyles = {}, fid, base = {}) {
  return { ...base, ...(fieldStyles[fid] || {}) };
}

export function resolveEducationDegree(item, index, total = 0) {
  const raw = typeof item?.degree === "string" ? item.degree.trim() : "";
  if (raw) return raw;
  if (total >= 2) {
    if (index === 0) return "硕士";
    if (index === 1) return "本科";
  }
  return "";
}

export function hasEntryContent(item) {
  if (!item || typeof item !== "object") return false;
  return Boolean(
    String(item.name || "").trim() ||
    String(item.company || "").trim() ||
    String(item.role || "").trim() ||
    String(item.details || "").trim() ||
    String(item.date || "").trim()
  );
}


