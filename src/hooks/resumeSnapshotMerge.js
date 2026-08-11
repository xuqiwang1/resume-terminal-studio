const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const hasUsableAvatar = (value) => typeof value === "string" && value.length > 0;

export function mergeResumeSnapshot(currentResume, incomingResume) {
  if (!currentResume || !incomingResume) return incomingResume;

  const next = { ...incomingResume };

  if (!hasUsableAvatar(incomingResume.avatar) && hasUsableAvatar(currentResume.avatar)) {
    next.avatar = currentResume.avatar;
  }

  if (!hasOwn(incomingResume, "avatarPos") && currentResume.avatarPos) {
    next.avatarPos = currentResume.avatarPos;
  }

  if (!hasOwn(incomingResume, "fieldStyles") && currentResume.fieldStyles) {
    next.fieldStyles = currentResume.fieldStyles;
  }

  if (!hasOwn(incomingResume, "layoutConfig") && currentResume.layoutConfig) {
    next.layoutConfig = currentResume.layoutConfig;
  }

  // Agents write content, not presentation. A snapshot that omits styleSettings must
  // not be read as "the user cleared their style" — keep what the workbench holds.
  if (!hasOwn(incomingResume, "styleSettings") && currentResume.styleSettings) {
    next.styleSettings = currentResume.styleSettings;
  }

  return next;
}
