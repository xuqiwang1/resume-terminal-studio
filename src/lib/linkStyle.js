export const LINK_STYLE_MODES = [
  { id: "default", label: "默认蓝色" },
  { id: "inherit", label: "跟随正文" },
  { id: "custom", label: "自定义" }
];

const DEFAULT_LINK_STYLE = {
  mode: "default",
  color: "#0645ad",
  underline: true
};

function normalizeUnderline(value) {
  return value === false ? false : true;
}

export function normalizeLinkStyle(value) {
  const input = value && typeof value === "object" ? value : {};
  const mode = LINK_STYLE_MODES.some((item) => item.id === input.mode)
    ? input.mode
    : DEFAULT_LINK_STYLE.mode;
  const color =
    typeof input.color === "string" && input.color.trim()
      ? input.color.trim()
      : DEFAULT_LINK_STYLE.color;

  return {
    mode,
    color,
    underline: normalizeUnderline(input.underline)
  };
}

export function buildLinkStyleVars(value) {
  const normalized = normalizeLinkStyle(value);
  const color = normalized.mode === "inherit" ? "inherit" : normalized.color;

  return {
    "--r-link-color": color,
    "--r-link-decoration": normalized.underline ? "underline" : "none"
  };
}
