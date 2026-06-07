/**
 * Minimal word/phrase-level diff for Chinese + English mixed text.
 * Splits by CJK punctuation and spaces, then runs a simple LCS diff.
 *
 * Returns an array of segments: {type: 'equal'|'delete'|'insert', text: string}
 */

function tokenize(text) {
  const tokens = [];
  const re = /([，。、；：！？""''（）\s,.:;!?()"']+)/;
  const parts = text.split(re);
  for (const part of parts) {
    if (part) tokens.push(part);
  }
  return tokens;
}

function lcsTable(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function backtrack(dp, a, b) {
  const segments = [];
  let i = a.length;
  let j = b.length;

  const pending = { del: [], ins: [] };

  function flushPending() {
    if (pending.del.length) {
      segments.push({ type: "delete", text: pending.del.join("") });
      pending.del = [];
    }
    if (pending.ins.length) {
      segments.push({ type: "insert", text: pending.ins.join("") });
      pending.ins = [];
    }
  }

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      flushPending();
      segments.push({ type: "equal", text: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      pending.del.unshift(a[i - 1]);
      i--;
    } else {
      pending.ins.unshift(b[j - 1]);
      j--;
    }
  }

  while (i > 0) {
    pending.del.unshift(a[i - 1]);
    i--;
  }
  while (j > 0) {
    pending.ins.unshift(b[j - 1]);
    j--;
  }

  flushPending();
  segments.reverse();
  return segments;
}

function mergeAdjacentEqual(segments) {
  const merged = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

export function computeTextDiff(before, after) {
  if (before === after) return [{ type: "equal", text: after }];
  if (!before) return [{ type: "insert", text: after }];
  if (!after) return [{ type: "delete", text: before }];

  const tokensA = tokenize(before);
  const tokensB = tokenize(after);
  const dp = lcsTable(tokensA, tokensB);
  const raw = backtrack(dp, tokensA, tokensB);
  return mergeAdjacentEqual(raw);
}

export function hasChanges(segments) {
  return segments.some((s) => s.type !== "equal");
}
