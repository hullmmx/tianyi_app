/**
 * 降级模板池 — LLM 重试 2 次后的兜底
 *
 * 输入:(category, verdict)
 * 输出:从对应桶随机抽 1 条 laogui
 *
 * fallback 路径绕过 validator 的 topic_keyword 必须扣题校验
 */

import fallbackData from '../../data/fallback-laogui.json' with { type: 'json' };
import type { YongshenCategory } from './yongshen.ts';

// 把 JSON 转成更易索引的结构
const POOL = fallbackData as Record<string, any>;

export function selectFallback(
  category: YongshenCategory,
  verdict: '是' | '否' | '缓'
): string {
  const cat = POOL[category];

  // 类别不存在 → fallback 到 self
  const bucket = cat?.[verdict] ?? POOL.self?.[verdict];

  if (!Array.isArray(bucket) || bucket.length === 0) {
    return '再陪自己一阵,这事还没到时候。';   // 终极兜底
  }

  return bucket[Math.floor(Math.random() * bucket.length)];
}

// ============================================================
// 暴露统计,供测试用
// ============================================================
export function getFallbackStats(): Record<string, Record<string, number>> {
  const stats: Record<string, Record<string, number>> = {};
  const cats = ['妻财', '官鬼', '子孙', '父母', '兄弟', 'self'];
  const verdicts = ['是', '否', '缓'];

  for (const cat of cats) {
    stats[cat] = {};
    for (const v of verdicts) {
      const bucket = POOL[cat]?.[v];
      stats[cat][v] = Array.isArray(bucket) ? bucket.length : 0;
    }
  }
  return stats;
}
