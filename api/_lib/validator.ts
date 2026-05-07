/**
 * LLM 输出复检 — 7 条铁律
 *
 * 任一不通过即视为复检失败,触发重试。3 次都失败 → 走 fallback。
 */

import blacklists from '../../data/blacklists.json' with { type: 'json' };

// ============================================================
// 扁平化黑名单(读 JSON 后展开)
// ============================================================
function flattenBlacklist(obj: any): string[] {
  const result: string[] = [];
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) result.push(...v);
    else if (typeof v === 'object' && v !== null) result.push(...flattenBlacklist(v));
  }
  return result;
}

const MYSTIC_WORDS = flattenBlacklist(blacklists.mystic_words);
const FORBIDDEN_WORDS = flattenBlacklist(blacklists.forbidden_words);
const CLICHE_PHRASES = flattenBlacklist(blacklists.cliche_phrases);

// ============================================================
// 文言指标字符
// ============================================================
const WENYAN_MARKERS = ['之', '也', '矣', '哉', '焉', '乎', '者', '然'];

// ============================================================
// 复检
// ============================================================
export interface Reading {
  verdict: '是' | '否' | '缓';
  laogui: string;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  detail?: string;
}

export interface ValidationContext {
  topicKeywords?: string[];   // 必须扣题——含其中之一即过(可选,fallback 路径不传)
  bypassTopicCheck?: boolean; // fallback 路径设为 true
}

export function validate(
  reading: Reading,
  context: ValidationContext = {}
): ValidationResult {
  // [1] verdict 三值之一
  if (!['是', '否', '缓'].includes(reading.verdict)) {
    return { ok: false, reason: 'verdict_invalid', detail: reading.verdict };
  }

  const laogui = reading.laogui ?? '';

  // [2] laogui 长度 10-28(含标点)
  const len = [...laogui].length;
  if (len < 10 || len > 28) {
    return { ok: false, reason: 'laogui_length', detail: `len=${len}` };
  }

  // [3] 玄学词
  for (const w of MYSTIC_WORDS) {
    if (laogui.includes(w)) {
      return { ok: false, reason: 'mystic_word_leaked', detail: w };
    }
  }

  // [4] 通用禁用词
  for (const w of FORBIDDEN_WORDS) {
    if (laogui.includes(w)) {
      return { ok: false, reason: 'forbidden_word', detail: w };
    }
  }

  // [5] 套语
  for (const c of CLICHE_PHRASES) {
    if (laogui.includes(c)) {
      return { ok: false, reason: 'cliche', detail: c };
    }
  }

  // [6] 必须扣题(fallback 路径绕过)
  if (!context.bypassTopicCheck && context.topicKeywords && context.topicKeywords.length > 0) {
    if (!context.topicKeywords.some((k) => laogui.includes(k))) {
      return { ok: false, reason: 'not_specific', detail: context.topicKeywords.join('/') };
    }
  }

  // [7] 文言指标 — 含 ≥3 个 wenyan markers 视为文言风
  const wenyanCount = WENYAN_MARKERS.filter((c) => laogui.includes(c)).length;
  if (wenyanCount >= 3) {
    return { ok: false, reason: 'classical_style', detail: `wenyan=${wenyanCount}` };
  }

  return { ok: true };
}

// ============================================================
// 暴露黑名单尺寸,供测试时检查覆盖度
// ============================================================
export const BLACKLIST_STATS = {
  mystic: MYSTIC_WORDS.length,
  forbidden: FORBIDDEN_WORDS.length,
  cliche: CLICHE_PHRASES.length,
};
