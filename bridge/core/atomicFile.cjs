const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

// A resume is the user's core asset, so a half-written file is not an acceptable
// failure mode. Every write lands in a sibling temp file, is flushed to the
// platform, and only then replaces the target with a single atomic rename. A
// reader therefore sees either the whole previous file or the whole new one —
// never a truncated prefix.

let counter = 0;

function tempPathFor(filePath) {
  counter += 1;
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${counter}`
  );
}

function writeFileAtomicSync(filePath, contents) {
  const tempPath = tempPathFor(filePath);
  let handle;
  try {
    handle = fs.openSync(tempPath, "wx", 0o600);
    fs.writeFileSync(handle, contents, "utf8");
    // Without the flush the rename can be durable while the data is not, which
    // on a crash yields exactly the empty/partial file this module exists to avoid.
    try {
      fs.fsyncSync(handle);
    } catch {
      // Some filesystems reject fsync; the rename is still atomic.
    }
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (handle !== undefined) {
      try {
        fs.closeSync(handle);
      } catch {
        // already closed
      }
    }
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // temp file may not exist
    }
    throw error;
  }
}

async function writeFileAtomic(filePath, contents) {
  const tempPath = tempPathFor(filePath);
  let handle;
  try {
    handle = await fsp.open(tempPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    try {
      await handle.sync();
    } catch {
      // Some filesystems reject fsync; the rename is still atomic.
    }
    await handle.close();
    handle = undefined;
    await fsp.rename(tempPath, filePath);
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // already closed
      }
    }
    try {
      await fsp.rm(tempPath, { force: true });
    } catch {
      // temp file may not exist
    }
    throw error;
  }
}

function writeJsonAtomicSync(filePath, value) {
  writeFileAtomicSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonAtomic(filePath, value) {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

// A file that is absent and a file that is corrupt are different problems, and
// collapsing both into "return the fallback" is how a damaged resume becomes a
// blank one on the next save. Corrupt content is moved aside so the bytes
// survive for recovery, and the caller is told it happened.
function quarantineCorruptFileSync(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const quarantinePath = `${filePath}.corrupt-${stamp}`;
  try {
    fs.renameSync(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    return null;
  }
}

function readJsonSync(filePath, { fallback = null, quarantine = false, label = "" } = {}) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { value: fallback, missing: true, corrupt: false };
    throw error;
  }
  if (!raw.trim()) return { value: fallback, missing: false, corrupt: false, empty: true };
  try {
    return { value: JSON.parse(raw), missing: false, corrupt: false };
  } catch (error) {
    const quarantinePath = quarantine ? quarantineCorruptFileSync(filePath) : null;
    return {
      value: fallback,
      missing: false,
      corrupt: true,
      quarantinePath,
      reason: `${label || filePath} is not valid JSON: ${error.message}`
    };
  }
}

module.exports = {
  quarantineCorruptFileSync,
  readJsonSync,
  writeFileAtomic,
  writeFileAtomicSync,
  writeJsonAtomic,
  writeJsonAtomicSync
};
