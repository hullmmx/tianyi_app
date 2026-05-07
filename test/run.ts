/**
 * 引擎本地测试 — 50 个真实决策问题跑通完整管道
 *
 * 不调 LLM,所有 verdict 由用神判定层产出,laogui 由 fallback 池抽取
 * 用 validator 检查每个 fallback 都不踩黑名单
 *
 * 运行:npm run test:engine
 */

import { castHexagram } from '../api/_lib/engine.ts';
import { deriveLineDetails } from '../api/_lib/liuqin.ts';
import { classifyByKeyword, assessYongshen } from '../api/_lib/yongshen.ts';
import { classifyRisk } from '../api/_lib/high-risk.ts';
import { validate, BLACKLIST_STATS } from '../api/_lib/validator.ts';
import { selectFallback, getFallbackStats } from '../api/_lib/fallback.ts';

// ============================================================
// 50 条测试问题
// ============================================================
const TEST_QUESTIONS = [
  // 日常消费(妻财)
  '要不要买这件大衣',
  '要不要换一台新电脑',
  '要不要订那个外卖套餐',
  '要不要买这只股票',
  '要不要把这辆车换掉',

  // 职业(官鬼)
  '要不要接这个项目',
  '要不要去面试那家公司',
  '要不要跟老板提加薪',
  '要不要辞职去新公司',
  '要不要把这个客户拒掉',

  // 孩子(子孙)
  '要不要给孩子报奥数班',
  '要不要让孩子学钢琴',
  '要不要送孩子去外地读书',
  '要不要再生一个',
  '要不要养一只猫',

  // 长辈 / 合同(父母)
  '要不要带父母去旅行',
  '要不要买这套房自住',
  '要不要去考研',
  '要不要听奶奶的话回老家',
  '要不要装修房子',

  // 朋友 / 合作(兄弟)
  '要不要跟他合伙',
  '要不要参加这个聚会',
  '要不要请同事帮忙',
  '要不要跟室友继续合租',
  '要不要进这个圈子',

  // 感情(歧义)
  '要不要跟他在一起',
  '要不要跟她分手',
  '要不要表白',
  '要不要回应他',
  '要不要相亲',

  // 自我(self)
  '要不要去剪头发',
  '要不要去那个城市旅行',
  '要不要早睡',
  '要不要开始健身',
  '要不要写日记',

  // 混合 / 边界
  '要不要在生日那天表白',
  '要不要给爸妈买保险',
  '要不要给孩子换学校',
  '要不要请假休息一周',
  '要不要发那条朋友圈',

  // 负面情绪(不应触发高危)
  '要不要跟父母吵一架',
  '要不要逃避一阵',
  '要不要假装没看见',
  '要不要装病请假',

  // 高危(应被拦截,不进起卦)
  '要不要自残一下',
  '要不要起诉他',
  '要不要全仓押这只股',
  '要不要吃这片药',
  '要不要跟他来一拳',
];

// ============================================================
// 颜色辅助(纯字符串,Windows / mac terminal 都兼容)
// ============================================================
const C = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m',
};
const c = (color: keyof typeof C, text: string) => `${C[color]}${text}${C.reset}`;

// ============================================================
// 主测试
// ============================================================
console.log();
console.log(c('bold', '🐢 天意 · 老龟问卦 · 引擎本地测试'));
console.log(c('dim', '━'.repeat(60)));
console.log(`测试问题: ${TEST_QUESTIONS.length} 条`);
console.log(
  `黑名单: 玄学=${BLACKLIST_STATS.mystic} 禁用=${BLACKLIST_STATS.forbidden} 套语=${BLACKLIST_STATS.cliche}`
);

const fbStats = getFallbackStats();
const fbTotal = Object.values(fbStats).reduce(
  (sum, c) => sum + Object.values(c).reduce((a, b) => a + b, 0),
  0
);
console.log(`Fallback 池: ${fbTotal} 条`);
console.log(c('dim', '─'.repeat(60)));

// ============================================================
// 统计
// ============================================================
const stats = {
  highRiskBlocked: 0,
  castSuccess: 0,
  yongshenCategories: {} as Record<string, number>,
  verdicts: { 是: 0, 否: 0, 缓: 0 } as Record<string, number>,
  movingLineCounts: {} as Record<string, number>,
  validatorPass: 0,
  validatorFail: 0,
  errors: [] as string[],
};

// ============================================================
// 跑每个问题
// ============================================================
for (const q of TEST_QUESTIONS) {
  console.log();
  console.log(c('cyan', `📝 ${q}`));

  try {
    // [1] 高危拦截
    const risk = classifyRisk(q);
    if (risk.flag) {
      console.log(c('yellow', `   ⚠️  HIGH-RISK [${risk.type}] — 不进起卦`));
      stats.highRiskBlocked++;
      continue;
    }

    // [2] 起卦
    const cast = castHexagram(new Date(), q);
    stats.castSuccess++;
    console.log(
      `   🔮 ${cast.ben.name}${cast.ben.unicode} → ${cast.bian.name}${cast.bian.unicode}` +
        c('dim', `  (${cast.benBinary} → ${cast.bianBinary})`)
    );
    console.log(
      `      动爻: ${cast.movingLines.length === 0 ? '无(静卦)' : `[${cast.movingLines.join(',')}]`}` +
        c('dim', `  · 老龟${cast.lineStates.join(' ')}`)
    );
    const mlcKey = String(cast.movingLines.length);
    stats.movingLineCounts[mlcKey] = (stats.movingLineCounts[mlcKey] ?? 0) + 1;

    // [3] 派生六爻属性
    const benBits = [...cast.benBinary].map((c) => parseInt(c));
    const bianBits = [...cast.bianBinary].map((c) => parseInt(c));
    const benLines = deriveLineDetails(cast.ben, benBits);
    const bianLines = deriveLineDetails(cast.bian, bianBits);

    const liuqinStr = benLines
      .slice()
      .reverse()    // 上爻在上
      .map((l) => `${l.pos}${l.yang ? '⚊' : '⚋'}${l.ganzhi}${l.liuqin}`)
      .join(' / ');
    console.log(c('dim', `      ${liuqinStr}`));

    // [4] 用神判定(关键词层)
    const ks = classifyByKeyword(q);
    let category = ks.category;
    let categoryNote = '';
    if (ks.needsLLMReview) {
      if (category === null) {
        category = 'self';
        categoryNote = ' (0 命中 → self)';
      } else {
        categoryNote = ' (歧义,需 Haiku)';
      }
    }
    console.log(
      `   🎯 用神: ${c('magenta', category!)} conf=${ks.confidence}${c('dim', categoryNote)}`
    );
    stats.yongshenCategories[category!] = (stats.yongshenCategories[category!] ?? 0) + 1;

    // [5] 用神状态评估
    const assessment = assessYongshen(category!, benLines, bianLines, cast.movingLines);
    const verdictColor: Record<string, keyof typeof C> = { 是: 'green', 否: 'red', 缓: 'yellow' };
    console.log(
      `   📊 ${assessment.status} → ${c(verdictColor[assessment.verdictHint], assessment.verdictHint)}`
    );
    stats.verdicts[assessment.verdictHint]++;

    // [6] Fallback 抽取(模拟 LLM 失败兜底)
    const laogui = selectFallback(category!, assessment.verdictHint);
    console.log(
      `   💬 ${c(verdictColor[assessment.verdictHint], `[${assessment.verdictHint}]`)} ${laogui}`
    );

    // [7] Validator(fallback 路径绕过 topic 检查)
    const v = validate({ verdict: assessment.verdictHint, laogui }, { bypassTopicCheck: true });
    if (v.ok) {
      stats.validatorPass++;
    } else {
      console.log(
        c('red', `   ❌ validator 失败: ${v.reason} ${v.detail ?? ''}`)
      );
      stats.validatorFail++;
      stats.errors.push(`${q} → ${v.reason}: ${v.detail}`);
    }
  } catch (err: any) {
    console.log(c('red', `   💥 ERROR: ${err.message}`));
    stats.errors.push(`${q} → ${err.message}`);
  }
}

// ============================================================
// 总结报告
// ============================================================
console.log();
console.log(c('dim', '━'.repeat(60)));
console.log(c('bold', '📊 测试报告'));
console.log(c('dim', '─'.repeat(60)));

console.log(`高危拦截:  ${c('yellow', String(stats.highRiskBlocked))}`);
console.log(`起卦成功:  ${c('green', String(stats.castSuccess))}`);
console.log(
  `Validator: 通过 ${c('green', String(stats.validatorPass))} / 失败 ${c('red', String(stats.validatorFail))}`
);

console.log();
console.log(c('bold', '用神类别分布:'));
for (const [cat, n] of Object.entries(stats.yongshenCategories).sort((a, b) => b[1] - a[1])) {
  const bar = '█'.repeat(n);
  console.log(`  ${cat.padEnd(8)} ${String(n).padStart(2)}  ${c('blue', bar)}`);
}

console.log();
console.log(c('bold', 'Verdict 分布:'));
const verdictColor: Record<string, keyof typeof C> = { 是: 'green', 否: 'red', 缓: 'yellow' };
for (const [v, n] of Object.entries(stats.verdicts)) {
  const bar = '█'.repeat(n);
  console.log(`  ${v}  ${String(n).padStart(2)}  ${c(verdictColor[v], bar)}`);
}

console.log();
console.log(c('bold', '动爻数量分布:'));
const mlSorted = Object.entries(stats.movingLineCounts).sort(
  (a, b) => parseInt(a[0]) - parseInt(b[0])
);
for (const [count, n] of mlSorted) {
  const bar = '█'.repeat(n);
  console.log(`  ${count} 动爻  ${String(n).padStart(2)}  ${c('cyan', bar)}`);
}

if (stats.errors.length > 0) {
  console.log();
  console.log(c('bold', c('red', '错误清单:')));
  stats.errors.forEach((e) => console.log(`  ⚠️  ${e}`));
}

const passRate = stats.validatorPass / (stats.validatorPass + stats.validatorFail || 1);
console.log();
console.log(c('dim', '━'.repeat(60)));
const verdict = stats.errors.length === 0 && passRate === 1
  ? c('green', '✅ 引擎层全绿,可进入 LLM 接入阶段(任务 a)')
  : c('red', '❌ 仍有失败用例,先修复');
console.log(verdict);
console.log();
