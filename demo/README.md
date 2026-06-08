# Resume Studio Demo Recording

This folder supports safe product demos with non-personal data.

Render the landing-page product reel without recording the desktop:

```bash
npm run demo:render-video
```

The renderer opens `demo/stage/recording-stage.html` in an offscreen Electron window, captures deterministic frames, and writes:

```text
site/assets/demo-patch-flow.mp4
site/assets/demo-patch-flow-poster.png
```

The frame content is limited to the terminal/MCP panel and Resume Studio app UI. It intentionally avoids browser chrome, desktop windows, and screen-recording focus issues.

Reset the demo workspace:

```bash
npm run demo:reset
```

Run the app against the demo workspace:

```bash
WORKSPACE_DIR="$PWD/demo/workspace" npm run dev:all
```

After the browser app is open, inject a reviewed AI edit:

```bash
npm run demo:patch
```

Generated runtime files live in `demo/workspace/` and are ignored by git.
