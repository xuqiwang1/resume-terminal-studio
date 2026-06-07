export function createSessionSnapshot({ session, pendingPatch, activityState }) {
  return {
    session: session || null,
    pendingPatch: pendingPatch || null,
    activityState: activityState || null
  };
}

export function desktopSessionInfo() {
  if (typeof window === "undefined") return null;
  if (!window.desktopApp?.isDesktop) return null;
  return {
    sessionId: window.desktopApp.sessionId || "",
    runtimeReady: Boolean(window.desktopApp.runtimeReady)
  };
}
