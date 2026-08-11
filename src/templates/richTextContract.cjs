// Shared, refactor-tolerant assertion for template link/metric rendering.
//
// The contract we protect is behavioral: each user-facing field must be rendered
// through <RichText> so that links and metric emphasis work. We key on the stable
// fieldId expression (the field's identity) and stay agnostic to attribute order
// and to the exact `value` expression. That way routine refactors — renaming a
// local variable, reordering props — don't produce false failures, while a field
// that genuinely stops going through RichText still fails the check.

function richTextTags(source) {
  // Each match is a single <RichText ...> opening tag. Value/fieldId expressions
  // in these templates never contain '>', so a tag ends at the first '>'.
  return source.match(/<RichText\b[^>]*>/g) || [];
}

// Returns true if some <RichText> tag carries every requested attribute, in any
// order. Pass `fieldId` to assert a field is wired through RichText; add `value`
// only when two tags share a fieldId and the value expression is what distinguishes them.
function rendersThroughRichText(source, { fieldId, value } = {}) {
  if (!fieldId && !value) return false;
  return richTextTags(source).some((tag) => {
    if (fieldId && !tag.includes(`fieldId={${fieldId}}`)) return false;
    if (value && !tag.includes(`value={${value}}`)) return false;
    return true;
  });
}

module.exports = { richTextTags, rendersThroughRichText };
