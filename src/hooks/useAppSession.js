import { useEffect, useState } from "react";
import { createSessionSnapshot, desktopSessionInfo } from "../lib/appClient";
import { fetchActivityState } from "../lib/fileClient";

export function useAppSession() {
  const [snapshot, setSnapshot] = useState(() =>
    createSessionSnapshot({
      session: desktopSessionInfo(),
      pendingPatch: null,
      activityState: null
    })
  );

  useEffect(() => {
    let cancelled = false;
    fetchActivityState()
      .then((data) => {
        if (cancelled) return;
        setSnapshot((current) =>
          createSessionSnapshot({
            session: current.session || desktopSessionInfo(),
            pendingPatch: current.pendingPatch,
            activityState: data.state || null
          })
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}
