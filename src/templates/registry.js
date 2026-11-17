import PonndTemplate from "./ponnd";
import ProfessionalTemplate from "./professional";
import ClassicTemplate from "./classic";
import ModernTemplate from "./modern";
import ExecutiveTemplate from "./executive";
import { A4_COMPACT_PRESETS } from "./stylePresets";

export const TEMPLATE_REGISTRY = [
  {
    id: "ponnd",
    name: "Ponnd",
    shortName: "瑞士极简",
    description: "Ponnd 瑞士编辑室极简风格，无衬线紧凑字距与细腻 1px 网格线",
    Component: PonndTemplate,
    stylePreset: A4_COMPACT_PRESETS.ponnd
  },
  {
    id: "professional",
    name: "Professional",
    shortName: "求职极简",
    description: "求职标准极简风，黑白密排，横线分隔",
    Component: ProfessionalTemplate,
    stylePreset: A4_COMPACT_PRESETS.professional
  },
  {
    id: "classic",
    name: "Classic",
    shortName: "经典单栏",
    description: "头像右置，标题横线分隔，适合密排求职简历",
    Component: ClassicTemplate,
    stylePreset: A4_COMPACT_PRESETS.classic
  },
  {
    id: "modern",
    name: "Modern",
    shortName: "现代风尚",
    description: "现代雅致排版，层级分明，呼吸感强",
    Component: ModernTemplate,
    stylePreset: A4_COMPACT_PRESETS.modern
  },
  {
    id: "executive",
    name: "Executive",
    shortName: "商务精英",
    description: "3列专业能力网格，稳重商务质感，模块级版式自由混搭",
    Component: ExecutiveTemplate,
    stylePreset: A4_COMPACT_PRESETS.executive
  }
];

export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY.find((t) => t.id === templateId) || TEMPLATE_REGISTRY[0];
}

export function getTemplatePreset(templateId) {
  return getTemplate(templateId).stylePreset;
}
