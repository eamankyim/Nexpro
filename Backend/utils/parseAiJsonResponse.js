/**
 * Extract and parse JSON from LLM text (code fences, prose wrappers, minor syntax issues).
 * @param {string} rawText - Model response text
 * @returns {{ ok: true, value: object } | { ok: false, error: string, jsonSnippet?: string }}
 */
function parseAiJsonResponse(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return { ok: false, error: 'empty response' };
  }

  const candidates = collectJsonCandidates(text);
  let lastError = 'no JSON object found';

  for (const candidate of candidates) {
    const parsed = tryParseWithRepairs(candidate);
    if (parsed !== null) {
      return { ok: true, value: parsed };
    }
    lastError = 'JSON.parse failed for candidate';
  }

  const primary = candidates[0];
  return {
    ok: false,
    error: lastError,
    jsonSnippet: primary
      ? { length: primary.length, head: primary.slice(0, 120), tail: primary.slice(-80) }
      : undefined
  };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function collectJsonCandidates(text) {
  const stripped = stripCodeFences(text);
  const out = [];
  const seen = new Set();

  const add = (s) => {
    const key = s?.slice(0, 200);
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  };

  add(extractBalancedJson(stripped));
  const greedy = stripped.match(/\{[\s\S]*\}/);
  if (greedy) add(greedy[0]);
  add(stripped);

  return out.filter(Boolean);
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripCodeFences(text) {
  let s = String(text || '').trim();
  const fullFence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence) return fullFence[1].trim();
  s = s.replace(/^```(?:json)?\s*/i, '');
  s = s.replace(/\s*```\s*$/i, '');
  return s.trim();
}

/**
 * Brace-balanced object slice from first `{`.
 * @param {string} text
 * @returns {string|null}
 */
function extractBalancedJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return text.slice(start);
}

/**
 * @param {string} jsonStr
 * @returns {object|null}
 */
function tryParseWithRepairs(jsonStr) {
  const variants = [
    jsonStr,
    repairTrailingCommas(jsonStr),
    closeTruncatedJson(jsonStr),
    repairTrailingCommas(closeTruncatedJson(jsonStr))
  ];

  for (const variant of variants) {
    if (!variant) continue;
    try {
      const value = JSON.parse(variant);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
    } catch {
      /* try next variant */
    }
  }

  const salvaged = salvageTruncatedAtBoundary(jsonStr);
  if (salvaged && salvaged !== jsonStr) {
    try {
      const value = JSON.parse(repairTrailingCommas(salvaged));
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}

/**
 * @param {string} jsonStr
 * @returns {string}
 */
function repairTrailingCommas(jsonStr) {
  return String(jsonStr).replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Append closing brackets/braces for truncated model output.
 * @param {string} jsonStr
 * @returns {string}
 */
function closeTruncatedJson(jsonStr) {
  const s = String(jsonStr);
  const stack = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }

  if (!inString && stack.length === 0) return s;
  let closed = s;
  if (inString) closed += '"';
  while (stack.length) closed += stack.pop();
  return closed;
}

/**
 * Truncate at last complete array element or object property, then close.
 * @param {string} jsonStr
 * @returns {string|null}
 */
function salvageTruncatedAtBoundary(jsonStr) {
  const s = String(jsonStr);
  const patterns = [/\}\s*,\s*$/m, /\]\s*,\s*$/m, /"\s*,\s*$/m];
  let best = null;
  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match && match.index !== undefined) {
      const cut = s.slice(0, match.index + 1);
      if (!best || cut.length > best.length) best = cut;
    }
  }
  if (!best) return null;
  return closeTruncatedJson(best);
}

module.exports = {
  parseAiJsonResponse,
  stripCodeFences,
  extractBalancedJson,
  repairTrailingCommas,
  closeTruncatedJson
};
