import ProfessionalTemplate from "./professional";
import EditorialTemplate from "./editorial";
import ClassicTemplate from "./classic";

const A4_COMPACT_PRESETS = {
  professional: {
    lineHeight: 1.32,
    sectionGap: 6,
    pagePadding: 24,
    fontSize: { heading: 19, body: 10, muted: 9 },
    ruleStyle: "thin"
  },
  editorial: {
    lineHeight: 1.35,
    sectionGap: 8,
    pagePadding: 24,
    fontSize: { heading: 22, body: 10, muted: 9 },
    ruleStyle: "thin"
  },
  classic: {
    lineHeight: 1.3,
    sectionGap: 6,
    pagePadding: 24,
    fontSize: { heading: 19, body: 10, muted: 9 },
    ruleStyle: "thin"
  }
};

export const TEMPLATE_REGISTRY = [
  {
    id: "professional",
    name: "Professional",
    shortName: "求职极简",
    description: "求职标准极简风，黑白密排，横线分隔",
    Component: ProfessionalTemplate,
    stylePreset: A4_COMPACT_PRESETS.professional
  },
  {
    id: "editorial",
    name: "Editorial",
    shortName: "苹果极简",
    description: "苹果风极简排版，左对齐大标题",
    Component: EditorialTemplate,
    stylePreset: A4_COMPACT_PRESETS.editorial
  },
  {
    id: "classic",
    name: "Classic",
    shortName: "经典单栏",
    description: "头像右置，标题横线分隔，适合密排求职简历",
    Component: ClassicTemplate,
    stylePreset: A4_COMPACT_PRESETS.classic
  }
];

export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY.find((t) => t.id === templateId) || TEMPLATE_REGISTRY[0];
}

export function getTemplatePreset(templateId) {
  return getTemplate(templateId).stylePreset;
}
