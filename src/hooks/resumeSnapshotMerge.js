const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const hasUsableAvatar = (value) => typeof value === "string" && value.length > 0;

// Presence of the key was the only test, so a snapshot carrying
// `styleSettings: {}` or `fieldStyles: null` counted as "the user set this" and
// wiped their styling. A value only wins if it actually holds something.
const hasUsableObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;

function preferIncomingObject(next, currentResume, incomingResume, key) {
  if (hasUsableObject(incomingResume[key])) return;
  if (hasUsableObject(currentResume[key])) {
    next[key] = currentResume[key];
    return;
  }
  // Neither side has anything usable: drop an explicit empty/null so downstream
  // normalizers see a missing key rather than a falsy one.
  if (hasOwn(incomingResume, key) && !hasUsableObject(incomingResume[key])) {
    delete next[key];
  }
}

export function mergeResumeSnapshot(currentResume, incomingResume) {
  if (!currentResume || !incomingResume) return incomingResume;

  const next = { ...incomingResume };

  if (!hasUsableAvatar(incomingResume.avatar) && hasUsableAvatar(currentResume.avatar)) {
    next.avatar = currentResume.avatar;
  }

  if (!hasOwn(incomingResume, "avatarPos") && currentResume.avatarPos) {
    next.avatarPos = currentResume.avatarPos;
  }

  // Agents write content, not presentation. A snapshot that omits — or blanks —
  // these keys must not be read as "the user cleared their style"; keep what the
  // workbench holds.
  preferIncomingObject(next, currentResume, incomingResume, "fieldStyles");
  preferIncomingObject(next, currentResume, incomingResume, "layoutConfig");
  preferIncomingObject(next, currentResume, incomingResume, "styleSettings");

  return next;
}
