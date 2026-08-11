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
