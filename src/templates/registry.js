import ProfessionalTemplate from "./professional";
import EditorialTemplate from "./editorial";

export const TEMPLATE_REGISTRY = [
  {
    id: "professional",
    name: "Professional",
    description: "求职标准极简风，黑白密排，横线分隔",
    Component: ProfessionalTemplate
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "苹果风极简排版，左对齐大标题",
    Component: EditorialTemplate
  }
];

export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY.find((t) => t.id === templateId) || TEMPLATE_REGISTRY[0];
}
