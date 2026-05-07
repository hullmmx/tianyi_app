/**
 * 纳甲 + 六亲推导
 *
 * 纳甲法(京房纳甲):
 *   阳卦(乾坎艮震)用阳支顺数(子寅辰午申戌)
 *   阴卦(坤巽离兑)用阴支逆数(未巳卯丑亥酉)
 *   各经卦起爻地支: 乾子坤未、震子巽丑、坎寅离卯、艮辰兑巳
 *
 * 六亲:本卦本宫五行 vs 每爻地支五行的生克比和关系
 *   比和(同行)         → 兄弟
 *   我生(本卦生爻)     → 子孙
 *   生我(爻生本卦)     → 父母
 *   我克(本卦克爻)     → 妻财
 *   克我(爻克本卦)     → 官鬼
 */

import type { Hexagram } from './engine.ts';

// ============================================================
// 八经卦的纳甲规则
// ============================================================
interface NayiaRule {
  innerStem: string;          // 内卦天干(初/二/三爻)
  outerStem: string;          // 外卦天干(四/五/六爻)
  branchSequence: [string, string, string, string, string, string]; // 6 爻地支(自下而上)
}

const NAYIA: Record<string, NayiaRule> = {
  乾: { innerStem: '甲', outerStem: '壬', branchSequence: ['子', '寅', '辰', '午', '申', '戌'] },
  坎: { innerStem: '戊', outerStem: '戊', branchSequence: ['寅', '辰', '午', '申', '戌', '子'] },
  艮: { innerStem: '丙', outerStem: '丙', branchSequence: ['辰', '午', '申', '戌', '子', '寅'] },
  震: { innerStem: '庚', outerStem: '庚', branchSequence: ['子', '寅', '辰', '午', '申', '戌'] },
  巽: { innerStem: '辛', outerStem: '辛', branchSequence: ['丑', '亥', '酉', '未', '巳', '卯'] },
  离: { innerStem: '己', outerStem: '己', branchSequence: ['卯', '丑', '亥', '酉', '未', '巳'] },
  坤: { innerStem: '乙', outerStem: '癸', branchSequence: ['未', '巳', '卯', '丑', '亥', '酉'] },
  兑: { innerStem: '丁', outerStem: '丁', branchSequence: ['巳', '卯', '丑', '亥', '酉', '未'] },
};

// ============================================================
// 地支 → 五行
// ============================================================
const BRANCH_ELEMENT: Record<string, '金' | '水' | '木' | '火' | '土'> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木',
  辰: '土', 巳: '火', 午: '火', 未: '土',
  申: '金', 酉: '金', 戌: '土', 亥: '水',
};

// ============================================================
// 五行相生 / 相克
// ============================================================
const GENERATES: Record<string, string> = {
  金: '水', 水: '木', 木: '火', 火: '土', 土: '金',
};
const CONTROLS: Record<string, string> = {
  金: '木', 木: '土', 土: '水', 水: '火', 火: '金',
};

// ============================================================
// 类型
// ============================================================
export type Liuqin = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';

export interface LineDetail {
  pos: number;             // 1..6
  yang: boolean;
  ganzhi: string;          // 例:庚子
  element: '金' | '水' | '木' | '火' | '土';
  liuqin: Liuqin;
}

// ============================================================
// 派生:卦的 6 爻 干支 + 五行
// ============================================================
export function deriveNayia(hexagram: Hexagram): { ganzhi: string; element: '金' | '水' | '木' | '火' | '土' }[] {
  const lower = NAYIA[hexagram.trigrams.lower];
  const upper = NAYIA[hexagram.trigrams.upper];
  if (!lower || !upper) {
    throw new Error(`Unknown trigram: ${hexagram.trigrams.upper}/${hexagram.trigrams.lower}`);
  }

  const result: { ganzhi: string; element: '金' | '水' | '木' | '火' | '土' }[] = [];

  // 初爻、二爻、三爻 用 下卦经卦 的 内 stem + branchSequence[0..2]
  for (let i = 0; i < 3; i++) {
    const branch = lower.branchSequence[i];
    result.push({
      ganzhi: lower.innerStem + branch,
      element: BRANCH_ELEMENT[branch],
    });
  }

  // 四爻、五爻、六爻 用 上卦经卦 的 外 stem + branchSequence[3..5]
  for (let i = 3; i < 6; i++) {
    const branch = upper.branchSequence[i];
    result.push({
      ganzhi: upper.outerStem + branch,
      element: BRANCH_ELEMENT[branch],
    });
  }

  return result;
}

// ============================================================
// 推导 单爻六亲
// ============================================================
export function deriveLiuqin(benElement: string, lineElement: string): Liuqin {
  if (benElement === lineElement) return '兄弟';
  if (GENERATES[benElement] === lineElement) return '子孙';   // 我生
  if (GENERATES[lineElement] === benElement) return '父母';   // 生我
  if (CONTROLS[benElement] === lineElement)  return '妻财';   // 我克
  if (CONTROLS[lineElement] === benElement)  return '官鬼';   // 克我
  // 不应到达
  throw new Error(`Cannot derive liuqin: ben=${benElement}, line=${lineElement}`);
}

// ============================================================
// 派生:整个卦的 6 爻完整属性
// ============================================================
export function deriveLineDetails(
  hexagram: Hexagram,
  benBits: number[]    // 6 个 0/1,自下而上
): LineDetail[] {
  const nayia = deriveNayia(hexagram);
  return nayia.map((n, i) => ({
    pos: i + 1,
    yang: benBits[i] === 1,
    ganzhi: n.ganzhi,
    element: n.element,
    liuqin: deriveLiuqin(hexagram.element, n.element),
  }));
}
