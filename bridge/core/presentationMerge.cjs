// Content and presentation have different owners. Agents write content, and the
// authoritative copy of it is the one on disk. Presentation — fonts, spacing,
// avatar placement, per-field styling — is edited in the workbench and may not be
// saved yet, so the client's copy of those keys is the newer one.
//
// /api/patch/confirm used to hydrate the server from the client's whole resume,
// which meant conflict detection compared the client's copy against itself: an
// edit written to disk between propose and accept was overwritten instead of
// reported. Merging only the presentation keys keeps unsaved styling while
// leaving content under disk authority, so conflicts are still detected.

const PRESENTATION_KEYS = ["styleSettings", "fieldStyles", "layoutConfig", "avatar", "avatarPos"];

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function mergePresentationOnto(baseResume, clientResume) {
  if (!baseResume || typeof baseResume !== "object") return clientResume || baseResume;
  if (!clientResume || typeof clientResume !== "object") return baseResume;

  const next = { ...baseResume };
  for (const key of PRESENTATION_KEYS) {
    if (!hasOwn(clientResume, key)) continue;
    const value = clientResume[key];
    // An explicit null avatar means "the user removed it"; an undefined value is
    // just a key the client never populated and must not clear what we have.
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
}

module.exports = {
  PRESENTATION_KEYS,
  mergePresentationOnto
};
