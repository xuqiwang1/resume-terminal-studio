const root = document.documentElement;
const body = document.body;
const commands = Array.from(document.querySelectorAll("[data-step]"));
const captions = Array.from(document.querySelectorAll(".caption-strip span"));

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (start, end, value) => {
  const x = clamp((value - start) / (end - start));
  return x * x * (3 - 2 * x);
};
const lerp = (from, to, value) => from + (to - from) * value;

function setVar(name, value) {
  root.style.setProperty(name, value);
}

function setPhase(progress) {
  if (progress < 0.16) return "boot";
  if (progress < 0.34) return "read";
  if (progress < 0.54) return "patch";
  if (progress < 0.68) return "review";
  if (progress < 0.82) return "history";
  return "export";
}

window.renderFrame = (progress = 0) => {
  const p = clamp(progress);
  body.dataset.phase = setPhase(p);

  const terminalGlow = smooth(0.02, 0.14, p);
  const appIntro = smooth(0.08, 0.2, p);
  const patch = smooth(0.32, 0.43, p) * (1 - smooth(0.62, 0.7, p));
  const after = smooth(0.58, 0.69, p);
  const history = smooth(0.66, 0.76, p) * (1 - smooth(0.82, 0.9, p));
  const exportState = smooth(0.78, 0.88, p);

  setVar("--terminal-glow", terminalGlow.toFixed(3));
  setVar("--app-x", `${lerp(26, 0, appIntro).toFixed(2)}px`);
  setVar("--app-scale", lerp(0.975, 1, appIntro).toFixed(4));
  setVar("--patch-opacity", patch.toFixed(3));
  setVar("--patch-y", `${lerp(36, 0, patch).toFixed(2)}px`);
  setVar("--patch-scale", lerp(0.96, 1, patch).toFixed(4));
  setVar("--after-opacity", after.toFixed(3));
  setVar("--after-offset", `${lerp(0, -26, after).toFixed(2)}px`);
  setVar("--history-opacity", history.toFixed(3));
  setVar("--history-x", `${lerp(36, 0, history).toFixed(2)}px`);
  setVar("--export-opacity", exportState.toFixed(3));
  setVar("--export-y", `${lerp(34, 0, exportState).toFixed(2)}px`);

  const activeIndex = Math.min(6, Math.floor(lerp(0, 6.99, smooth(0.08, 0.88, p))));
  commands.forEach((line, index) => {
    line.classList.toggle("is-done", index < activeIndex);
    line.classList.toggle("is-active", index === activeIndex);
  });

  captions.forEach((item, index) => {
    const active = index === Math.min(4, Math.floor(lerp(0, 4.99, smooth(0.12, 0.9, p))));
    item.style.background = active ? "rgba(203, 255, 63, 0.72)" : "rgba(255, 255, 255, 0.46)";
    item.style.color = active ? "#171713" : "rgba(23, 23, 19, 0.58)";
    item.style.borderColor = active ? "rgba(23, 23, 19, 0.16)" : "rgba(23, 23, 19, 0.1)";
  });
};

window.renderFrame(0);

if (new URLSearchParams(window.location.search).has("play")) {
  const startedAt = performance.now();
  const duration = 18000;
  const tick = () => {
    const elapsed = (performance.now() - startedAt) % duration;
    window.renderFrame(elapsed / duration);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
