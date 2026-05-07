/**
 * 引擎核心 — 时间起卦 + 卦象查找
 *
 * 起卦逻辑:模拟掷三枚铜钱六次的概率分布
 *   3 正(各计 3) → 9 老阳 (动) — 概率 1/8
 *   3 反(各计 2) → 6 老阴 (动) — 概率 1/8
 *   2 正 1 反    → 8 少阴(不动) — 概率 3/8
 *   1 正 2 反    → 7 少阳(不动) — 概率 3/8
 *
 * 用 Mulberry32 PRNG seeded by 时间戳 + 问题字符 → 确定性,同一时刻同一问题恒同卦
 */

import hexagramsData from '../../data/hexagrams-64.json' with { type: 'json' };

// ============================================================
// Types
// ============================================================
export interface Hexagram {
  id: number;
  name: string;
  pinyin: string;
  unicode: string;
  trigrams: { upper: string; lower: string };
  palace: string;
  element: '金' | '水' | '木' | '火' | '土';
  binary: string;
  judgement: string;
  image: string;
  essence: string;
  tags: string[];
  lines: { pos: number; text: string; hint: string }[];
}

export type LineState = '老阴' | '老阳' | '少阴' | '少阳';

export interface CastResult {
  ben: Hexagram;
  bian: Hexagram;
  benBinary: string;        // 6 chars, 自下而上(初爻在左)
  bianBinary: string;
  lineStates: LineState[];  // 6 个,自下而上
  movingLines: number[];    // 1..6 中动爻位
  computedAt: string;       // 台北时间 ISO
}

const HEXAGRAMS = hexagramsData.hexagrams as Hexagram[];

// ============================================================
// PRNG: Mulberry32(确定性,同种子同结果)
// ============================================================
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 把字符串折叠成 32-bit 哈希(用于种子)
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ============================================================
// 起卦
// ============================================================
export function castHexagram(timestamp: Date, question: string): CastResult {
  // 校准为台北时间(产品默认 CST)
  const tw = new Date(
    timestamp.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })
  );
  const seed =
    (tw.getTime() / 1000) | 0 ^ hashString(question.trim());
  const rng = mulberry32(seed);

  const lineStates: LineState[] = [];
  const benBits: number[] = [];
  const bianBits: number[] = [];

  for (let i = 0; i < 6; i++) {
    // 三枚铜钱:0(背)= 2 / 1(正)= 3
    const c1 = rng() < 0.5 ? 0 : 1;
    const c2 = rng() < 0.5 ? 0 : 1;
    const c3 = rng() < 0.5 ? 0 : 1;
    const sum = (c1 ? 3 : 2) + (c2 ? 3 : 2) + (c3 ? 3 : 2);

    let state: LineState;
    let benBit: number;
    let bianBit: number;

    if (sum === 6) {
      state = '老阴';
      benBit = 0;   // 阴
      bianBit = 1;  // 化阳
    } else if (sum === 9) {
      state = '老阳';
      benBit = 1;   // 阳
      bianBit = 0;  // 化阴
    } else if (sum === 7) {
      state = '少阳';
      benBit = 1;
      bianBit = 1;
    } else {
      state = '少阴';
      benBit = 0;
      bianBit = 0;
    }

    lineStates.push(state);
    benBits.push(benBit);
    bianBits.push(bianBit);
  }

  const benBinary = benBits.join('');
  const bianBinary = bianBits.join('');

  const movingLines = lineStates
    .map((s, i) => (s === '老阴' || s === '老阳' ? i + 1 : -1))
    .filter((p) => p > 0);

  const ben = findByBinary(benBinary);
  const bian = findByBinary(bianBinary);

  return {
    ben,
    bian,
    benBinary,
    bianBinary,
    lineStates,
    movingLines,
    computedAt: tw.toISOString(),
  };
}

// ============================================================
// 卦象查找
// ============================================================
export function findByBinary(binary: string): Hexagram {
  const found = HEXAGRAMS.find((h) => h.binary === binary);
  if (!found) {
    throw new Error(`Hexagram not found for binary: ${binary}`);
  }
  return found;
}

export function findById(id: number): Hexagram {
  const found = HEXAGRAMS.find((h) => h.id === id);
  if (!found) throw new Error(`Hexagram not found for id: ${id}`);
  return found;
}
