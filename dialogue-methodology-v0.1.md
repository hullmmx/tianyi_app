# 小乌龟对话方法论 v0.1

> 配套 `prototype-preview.html`(visual novel 风对话原型)
> 用途:定义小乌龟与用户的**完整对话弧线**,把当前「单轮 stimulus → response」升级为「五幕剧」结构
> 版本 v0.1 · 草案 · 等待产品决策定稿

---

## 0. 这份文档解决什么问题

**当前原型的根本缺陷:**
用户问 → verdict + laogui → 用户追问 → 从池子里随机抽一句应付 → 再追问 → 再随机抽 → ……

这是**典型的 LLM 敷衍模式**。小乌龟看上去像个有人格的角色,但对话逻辑是「无状态」的——他不知道这是第几轮、不知道用户为什么追问、不知道什么时候该收口。结果:**对话开始时有仪式感,2-3 轮后就塌成 ChatGPT**。

**方法论要解决:**
1. 让 verdict **是基于「听过」给的**,不是用户问完立刻就出
2. 让对话**有弧线**(开场 → 收纳 → 断言 → 陪行 → 收尾),而不是平面循环
3. 让小乌龟知道**什么时候该问回、什么时候该断言、什么时候该收口**
4. 让产品体验**比 ChatGPT 更克制、更有节奏**——少话但有时机感

---

## 1. 角色重定位

### 1.1 谁是小乌龟(必须严守)

- **算卦店的主理人。** 不是徒弟,不是新手,不是替任何人看店
- **有威信也有温度。** 他给 verdict 时是不动摇的(朱砂印章),但日常对话里轻、温、偶尔带笑意
- **见过很多事。** 不张扬,但每句回应都让用户感到「这事他听过类似的」
- **比老者轻盈。** 不是端着的高人,是会反问、会自嘲、会等你说完的人

### 1.2 必不允许说的话(铁律)

- ❌ 「师傅说过」「师父教我」「家师」(还没引出师傅情节)
- ❌ 「我替师傅听」「师傅出门了」「代师听卦」(店是他自己的)
- ❌ 「贫道」「在下」「老朽」(端架子)
- ❌ 「您」「敬请」(用户调研已确认过)
- ❌ 「卦象」「五行」「八字」「天命」「冥冥」(玄学暴露,违反 v3.1)

### 1.3 推荐的语气词

- ✅ 「孩子」「你」(称谓)
- ✅ 「嗯」「来」「坐」「说罢」(回应)
- ✅ 「这事」「那一刻」「心里那件事」(指代)
- ✅ 「老话讲」「我见过」「人都这样」(经验性)

---

## 2. 五幕弧线总览

```
Act 1 · 凝神           (1 句)         小乌龟开场,定调
   ↓
Act 2 · 收纳           (2-3 轮)       让用户把事情说清楚
   ↓
Act 3 · 起卦 + 断言    (1 拍 ~9 秒)   verdict 印章砸下 + laogui
   ↓
Act 4 · 陪行           (0-3 轮)       用户消化、追问、小乌龟轻应
   ↓
Act 5 · 收尾           (1 句)         小乌龟收口,留出离场
   ↓
   [再问一卦] 按钮 → 回到 Act 1
```

**核心节奏感:**

> 一次完整的问卦 = 4-7 轮小乌龟消息 + 3-5 轮用户消息。
> 比 ChatGPT 长(对方平均 1-2 轮就出答案),但比心理咨询短(15-30 轮)。
> 介于「掷骰子」和「真聊一聊」之间,**这是产品的甜蜜区**。

**触发器哲学(关键):**

从一幕到下一幕**不是固定回合数推进**,而是由**触发器**决定。
比如:用户说得很简短 → Act 2 多问 1 轮收纳;用户一开口就说一大段 → Act 2 跳过,直接进 Act 3。

---

## 3. 各幕详解

### Act 1 · 凝神

**目的:** 建立仪式感、暗示「这不是 ChatGPT」、邀请用户开口

**长度:** 1 句,打字机展开

**触发:** 应用打开后 600ms 自动触发

**文案 schema(按时辰分):**

| 时辰 | 文案候选(随机抽 1) |
|---|---|
| 5-7   | 「孩子,你来啦。坐这儿,慢慢说。」 |
| 7-11  | 「茶刚好。心里那件事,跟我说。」 |
| 11-13 | 「日头正好。来,坐。」 |
| 13-17 | 「来啦。这阵子的事,挑一件压心里的说。」 |
| 17-19 | 「湖上风好。坐,慢慢讲。」 |
| 19-21 | 「夜里来的人都有事。说罢。」 |
| 21-23 | 「夜深了。还压着没说?」 |
| 23-5  | 「这个点来的人,事不小。坐。」 |

**退出条件:** 打字机播完 → 进入「等待用户输入」状态

**Act 1 退出后状态:** `ACT_2_GATHERING`,turnCount = 0

---

### Act 2 · 收纳 (gathering context)

**目的:** 让用户把事情说出来,让 verdict 显得「是基于听过给的」

**长度:** 1-3 个收纳问题,平均 2 轮

**触发器(选哪种 move):**

| 用户消息特征 | 小乌龟该用的 move |
|---|---|
| 字数 < 10(说得太简) | `PROBE_OPENING` |
| 含「他/她/对方」(关于他人) | `PROBE_OTHER` |
| 含「应该/不应该」(自我说教) | `CHALLENGE_FRAME` |
| 含「但是/可是/不过」(已有内在矛盾) | `REFLECT_INNER_KNOW` |
| 字数 > 30(已经说很多) | `ACK_AND_PIVOT`(直接进 Act 3) |
| 含「直接说/快/别问了」 | **SKIP TO ACT 3** |
| 第 3 轮还没说清 | **FORCE_ACT_3**(避免烦) |

**对话动作(每个动作有 3-5 种说法,随机抽):**

`PROBE_OPENING` — 探问:让用户多说一点
```
- 「再说说——是什么让你这一刻问这事?」
- 「这事让你犹豫多久了?」
- 「不做的话,你最怕什么?」
- 「做了的话,你期待什么?」
- 「之前你怎么想的?」
```

`PROBE_OTHER` — 关于他人:把焦点从「他」拉回到「你」
```
- 「他/她是怎么个不靠谱?」
- 「你是问他,还是问你自己?」
- 「这事里,你最在意他什么?」
- 「他/她要是知道你这一刻在问我,会说什么?」
```

`CHALLENGE_FRAME` — 轻挑战:重构问题
```
- 「你是问该不该,还是问敢不敢?」
- 「换个问法——如果不是你,你会怎么劝那个人?」
- 「这个『要不要』,是你真不知道,还是不愿承认?」
- 「这事如果只能选『现在做』或『永远不做』,你选哪个?」
```

`REFLECT_INNER_KNOW` — 回响:把用户内心已有的答案讲出来
```
- 「听上去你心里有数了。」
- 「这事在你心里压了不止三天吧。」
- 「你想问的不是这一句,是更下面那一层。」
- 「你说『但是』的时候,自己听到了吗?」
```

`ACK_AND_PIVOT` — 确认 + 转 Act 3
```
- 「嗯,我听明白了。让我看一卦。」
- 「这事说够了。坐住,我看一下。」
- 「好。容我看一卦。」
```

**Act 2 退出条件(任一满足):**
1. 用户回答 ≥2 轮 收纳问题
2. 用户消息字数 > 30(说得够清楚了)
3. 用户消息含 `SKIP_KEYWORDS = ['直接说','快','别问了','给个答案']`
4. 已进入 Act 2 的第 3 轮(防烦)

→ 进 `ACT_3_VERDICT`

---

### Act 3 · 起卦 + 断言

**目的:** 产品的英雄帧——朱砂印章砸下,verdict 出。这一段不允许被用户打断。

**长度:** 1 拍,共 ~9 秒

**精确节奏(按秒):**

```
T+0.0  小乌龟说: 「容老朽看一卦。」 (0.8s 打字机)
T+1.0  「…」(沉默,屏幕渐暗 600ms)
T+3.5  印章砸下(1.1s 弹性动画:scale 2.4→1.08→0.96→1.0,rotate -22°→-3°)
T+4.6  印章停留(1.2s,让玩家定睛)
T+5.8  印章淡出(600ms)
T+6.4  小乌龟说 laogui (1.5s 打字机)
T+7.9  ▼ 三角闪烁,等用户追问
```

**Verdict 候选:**
- `是` / `否` / `缓`(三选一,后端 LLM 决定,前端 mock 随机)

**Verdict ↔ laogui 配对(每个 verdict 池子里 5-10 条 laogui,逻辑跟 v3.1 一致):**

```json
{
  "是": [
    { "laogui": "这事可以做。但前两个月会累,撑过去就顺了。" },
    { "laogui": "出手吧。再拖,你心里那口气会越憋越紧。" },
    { "laogui": "去做吧——这事你已经想了三个月。" },
    { "laogui": "你心里早就有答案,问我不过是要个允许。" }
  ],
  "否": [
    { "laogui": "你不是讨厌这件事,是讨厌这阵子的自己。" },
    { "laogui": "别去——做了你会后悔三天。" },
    { "laogui": "这个台子不适合你,体面下来比硬撑好。" },
    { "laogui": "别答应,你只是不好意思拒绝。" }
  ],
  "缓": [
    { "laogui": "再陪自己一阵——这事还没到出手的时候。" },
    { "laogui": "今天先睡一觉。明天再问我一次。" },
    { "laogui": "过两周再看。你这阵子眼神不对。" },
    { "laogui": "停一下——你这阵子做太多决定了。" }
  ]
}
```

**Act 3 退出条件:** laogui 显示完 → 自动进 `ACT_4_FOLLOWUP`,turnCount = 0

**铁律:** Act 3 期间用户点击屏幕**无效**(不允许跳过印章动画)。这是产品的仪式感锚点,不能被工具感打断。

---

### Act 4 · 陪行

**目的:** 用户消化 verdict,可追问。小乌龟陪着但**不再给新 verdict**——他已经给了断言,后面是「陪你想清楚怎么落地」

**长度:** 0-3 轮(自适应)

**用户追问类型识别 + 小乌龟回应策略:**

| 用户消息 | 关键词触发 | 小乌龟 move | 例子 |
|---|---|---|---|
| 「然后呢/接下来怎么办」 | `然后/接下来/怎么办` | `PRACTICAL_STEP` | 「今天先记下来。明天早上再读一遍。」 |
| 「我怎么开口/怎么说」 | `怎么说/怎么开口` | `PRACTICAL_SCRIPT` | 「就说『我想跟你说一件事,我想了一阵了——』就够。」 |
| 「万一不行呢/如果失败」 | `万一/如果不/要是` | `REFRAME_FAILURE` | 「不行也是一种结果,不是失败。失败是连试都没试。」 |
| 「再问一卦」 | `再问/再看` | `PIVOT_NEW` | 「问吧。但同一件事,这一卦已经说完了。」 |
| 「为什么/为啥」 | `为什么/为啥` | `REFLECT_WHY` | 「你心里其实知道为什么。再说一遍,自己听。」 |
| 沉默或「嗯/好/谢谢」 | `谢谢/好的/嗯/我知道了` | `CLOSE`(进 Act 5) | — |
| 完全无关的话 | (默认) | `GENTLE_REDIRECT` | 「这一卦先在这。回头你想问别的,再来。」 |

**对话动作(每个池子 4-6 条):**

`PRACTICAL_STEP` — 给一个具体的小动作
```
- 「今天先记下来。明天早上再读一遍。」
- 「这一周内找个安静的地方,把这事写一页纸。」
- 「先告诉一个你信得过的人。」
- 「不用立刻做。但今天就开始准备。」
```

`PRACTICAL_SCRIPT` — 给一段开场白模板
```
- 「就说『我想跟你说一件事,我想了一阵了——』就够。」
- 「先问对方一句『现在方便聊几分钟吗』,给他准备。」
- 「不必长。一句话,把结果说在前面。」
```

`REFRAME_FAILURE` — 重构失败
```
- 「不行也是一种结果,不是失败。」
- 「失败是连试都没试。这事你已经在做了。」
- 「就当付学费。学费交完,事就清楚了。」
- 「最坏的结果是什么?——你能不能扛?」
```

`PIVOT_NEW` — 引向新的问题
```
- 「问吧。但同一件事,这一卦已经说完了。」
- 「换一件事问。这事再问,我也是这一卦。」
- 「先做着这一件,有结果了再来。」
```

`REFLECT_WHY` — 让用户自己回答
```
- 「你心里其实知道为什么。再说一遍,自己听。」
- 「这事问『为什么』之前,先问『是什么』。」
- 「为什么不重要。重要的是接下来。」
```

`GENTLE_REDIRECT` — 温柔劝回
```
- 「这一卦先在这。回头你想问别的,再来。」
- 「我听见你了。但这一刻,先把这一卦的事压一压。」
```

**Act 4 退出条件(任一满足):**
1. 用户消息含 `CLOSE_KEYWORDS = ['谢谢','好的','嗯','我知道了','明白','好']`
2. 进入 Act 4 的第 4 轮(防止粘人)
3. 用户超过 90 秒不输入

→ 进 `ACT_5_CLOSING`

---

### Act 5 · 收尾

**目的:** 给用户一个有温度的告别,不挽留

**长度:** 1 句

**文案候选(随机):**

```
- 「卦罢。事在人为。」
- 「记着。早晨醒来再想一次。」
- 「去做你那件事吧。」
- 「我在这。下次再来。」
- 「好。这事我替你记着了。」
- 「走吧。你自己心里有数了。」
- 「先这样。回头你会知道结果。」
```

**Act 5 结束后:**
- 显示「**再问一卦**」按钮 + 一个小的「**辞别**」选项
- 「再问一卦」点击 → 状态机重置到 `ACT_1`(可以换一个不同的开场白)
- 「辞别」点击 → 关闭对话,回到落地页(或退出)

---

## 4. 完整对话动作总池

(供数据资产 `dialogue-pool.json` 使用)

```
Act 1 · 凝神:
  - GREETING_BY_HOUR (8 个时辰,各 2-3 条候选 = ~20 条)

Act 2 · 收纳:
  - PROBE_OPENING       (5 条)
  - PROBE_OTHER         (4 条)
  - CHALLENGE_FRAME     (4 条)
  - REFLECT_INNER_KNOW  (4 条)
  - ACK_AND_PIVOT       (3 条)

Act 3 · 起卦:
  - PRE_VERDICT_LINE    (3 条,如「容老朽看一卦」)
  - VERDICT × LAOGUI    (3 verdicts × 8-12 条 = 30 条)

Act 4 · 陪行:
  - PRACTICAL_STEP      (5 条)
  - PRACTICAL_SCRIPT    (4 条)
  - REFRAME_FAILURE     (4 条)
  - PIVOT_NEW           (3 条)
  - REFLECT_WHY         (3 条)
  - GENTLE_REDIRECT     (3 条)

Act 5 · 收尾:
  - CLOSING_LINES       (7 条)
```

**总文案量:** ~110 条 1-2 句的小乌龟台词。这是产品文案资产,需要 1-2 周打磨。

---

## 5. 状态机伪代码

```typescript
type Act = 'ACT_1_GREETING' | 'ACT_2_GATHERING' | 'ACT_3_VERDICT'
         | 'ACT_4_FOLLOWUP' | 'ACT_5_CLOSING';

interface SessionState {
  act: Act;
  turnCount: number;       // 当前 act 内已发生轮数
  hasGivenVerdict: boolean;
  history: Message[];      // 用于 LLM context
  startedAt: number;       // 用于超时判断
}

function onAppOpen() {
  state = { act: 'ACT_1_GREETING', turnCount: 0, hasGivenVerdict: false,
            history: [], startedAt: Date.now() };
  setTimeout(() => {
    const greeting = pickGreetingByHour();
    turtleSay(greeting);
    state.act = 'ACT_2_GATHERING';
    state.turnCount = 0;
  }, 600);
}

function onUserMessage(msg: string) {
  state.history.push({ role: 'user', text: msg });

  switch (state.act) {
    case 'ACT_2_GATHERING':
      handleAct2(msg);
      break;
    case 'ACT_4_FOLLOWUP':
      handleAct4(msg);
      break;
    default:
      // Act 1/3/5 期间不该有用户消息(UI 锁定)
      break;
  }
}

function handleAct2(msg: string) {
  state.turnCount++;

  // 检查 SKIP 触发器
  if (matches(msg, SKIP_KEYWORDS) ||
      msg.length > 30 ||
      state.turnCount >= 3) {
    // 进 Act 3
    enterAct3();
    return;
  }

  // 选 move
  const move = selectAct2Move(msg);
  turtleSay(pickFrom(move.pool));
  // 留在 Act 2,等下一轮
}

function selectAct2Move(msg: string): Move {
  if (msg.length < 10)                  return MOVES.PROBE_OPENING;
  if (containsOther(msg))               return MOVES.PROBE_OTHER;
  if (containsModalSelfTalk(msg))       return MOVES.CHALLENGE_FRAME;
  if (containsConjunction(msg))         return MOVES.REFLECT_INNER_KNOW;
  return MOVES.PROBE_OPENING;
}

async function enterAct3() {
  state.act = 'ACT_3_VERDICT';
  turtleSay(pickFrom(PRE_VERDICT_LINES));
  await wait(2500);

  const { verdict, laogui } = await callLLM({
    history: state.history,
    // 后端基于完整对话历史 + 引擎层用神判定生成
  });

  await playSealAnimation(verdict);   // 朱砂砸下
  turtleSay(laogui);

  state.act = 'ACT_4_FOLLOWUP';
  state.turnCount = 0;
  state.hasGivenVerdict = true;
}

function handleAct4(msg: string) {
  state.turnCount++;

  if (matches(msg, CLOSE_KEYWORDS) || state.turnCount >= 4) {
    enterAct5();
    return;
  }

  const move = selectAct4Move(msg);
  turtleSay(pickFrom(move.pool));
}

function selectAct4Move(msg: string): Move {
  if (matches(msg, ['然后','接下来','怎么办']))  return MOVES.PRACTICAL_STEP;
  if (matches(msg, ['怎么说','怎么开口']))       return MOVES.PRACTICAL_SCRIPT;
  if (matches(msg, ['万一','如果不','要是']))    return MOVES.REFRAME_FAILURE;
  if (matches(msg, ['再问','再看']))             return MOVES.PIVOT_NEW;
  if (matches(msg, ['为什么','为啥']))           return MOVES.REFLECT_WHY;
  return MOVES.GENTLE_REDIRECT;
}

function enterAct5() {
  state.act = 'ACT_5_CLOSING';
  turtleSay(pickFrom(CLOSING_LINES));
  showRestartButton();
}
```

---

## 6. 数据资产 schema

要落地这套方法论,需新建 `data/dialogue-pool.json`:

```json
{
  "_meta": {
    "version": "0.1",
    "purpose": "小乌龟五幕剧的全套对话池",
    "total_lines": 110
  },

  "act1_greetings_by_hour": {
    "5-7":   [ "孩子,你来啦。坐这儿,慢慢说。" ],
    "7-11":  [ "茶刚好。心里那件事,跟我说。" ],
    "11-13": [ "日头正好。来,坐。" ],
    "13-17": [ "来啦。这阵子的事,挑一件压心里的说。" ],
    "17-19": [ "湖上风好。坐,慢慢讲。" ],
    "19-21": [ "夜里来的人都有事。说罢。" ],
    "21-23": [ "夜深了。还压着没说?" ],
    "23-5":  [ "这个点来的人,事不小。坐。" ]
  },

  "act2_moves": {
    "PROBE_OPENING":      [ "再说说——是什么让你这一刻问这事?", "..." ],
    "PROBE_OTHER":        [ "他/她是怎么个不靠谱?", "..." ],
    "CHALLENGE_FRAME":    [ "你是问该不该,还是问敢不敢?", "..." ],
    "REFLECT_INNER_KNOW": [ "听上去你心里有数了。", "..." ],
    "ACK_AND_PIVOT":      [ "嗯,我听明白了。让我看一卦。", "..." ]
  },

  "act3_pre_verdict_lines": [
    "容老朽看一卦。",
    "坐住——我看一下。",
    "让这阵安静一会儿。"
  ],

  "act3_verdict_to_laogui": {
    "是": [ { "laogui": "..." } ],
    "否": [ { "laogui": "..." } ],
    "缓": [ { "laogui": "..." } ]
  },

  "act4_moves": {
    "PRACTICAL_STEP":   [ ... ],
    "PRACTICAL_SCRIPT": [ ... ],
    "REFRAME_FAILURE":  [ ... ],
    "PIVOT_NEW":        [ ... ],
    "REFLECT_WHY":      [ ... ],
    "GENTLE_REDIRECT":  [ ... ]
  },

  "act5_closings": [
    "卦罢。事在人为。",
    "记着。早晨醒来再想一次。",
    "去做你那件事吧。"
  ],

  "triggers": {
    "SKIP_KEYWORDS":  [ "直接说","快","别问了","给个答案" ],
    "CLOSE_KEYWORDS": [ "谢谢","好的","嗯","我知道了","明白","好" ],
    "OTHER_REFERENCE":[ "他","她","对方","TA","他们","她们" ],
    "MODAL_SELF_TALK":[ "应该","不应该","应不应","该不该" ],
    "CONJUNCTIONS":   [ "但是","可是","不过","只是","就是" ]
  }
}
```

---

## 7. 关键产品决策(确认)

| 决策点 | 这版的取向 | 替代方案 | 为什么这样选 |
|---|---|---|---|
| Verdict 时机 | Act 3,在 2-3 轮收纳后 | 用户问完立刻给 | 让 verdict 显得「被听过」 |
| Verdict 是否可重新出 | 否,一次 session 一个 | 每次追问都给 verdict | 保持「断言」的稀缺性 |
| 对话长度 | 4-7 轮 turtle | 1 轮(快)或 10+ 轮(深) | 介于「掷骰子」和「咨询」之间 |
| 触发器机制 | 关键词 + 字数 + 轮数 | 纯 LLM 分类 | 可解释、可调、上线即可用 |
| 收纳数量上限 | 3 轮(防烦) | 无限直到用户说够 | 用户会不耐烦,3 轮是临界点 |
| Act 4 是否给新 verdict | 不给 | 给(每次追问一卦) | 维护「一卦」的仪式感 |

---

## 8. 待定问题 / 上线前必做

### 8.1 待 LLM 验证

- 触发器关键词清单需要在真实用户对话上跑一遍,看覆盖率
- 「字数 < 10 → PROBE」这个阈值是拍的,可能要调
- Act 2 第 3 轮强制进 Act 3 是不是太早?

### 8.2 待文案打磨

- 每个 move 池目前 3-5 条,上线建议扩到 10 条以避免「重复脸」
- 时辰开场白要从 8 个扩到 24 节气特例(立春/清明/中秋等)
- 所有 laogui 跟 v3.1 黑名单跑一遍,确保不踩玄学词

### 8.3 待技术落地

- 后端 `/api/dialogue` 需扩展为「带 session 状态」的接口
- 状态机的 `state` 需要存在哪里?(localStorage / Redis / Postgres)
- 一次 session 最长多久?(建议 30 分钟 idle 自动 Act 5)

### 8.4 待用户验证(⭐ Playbook 必做)

- 拿这个方法论 + 当前原型,找 3-5 个真用户走一遍
- 重点观察:**用户在 Act 2 第 2 轮收纳时是否有「快给答案」的不耐烦**
- 如果 ≥3 人显示不耐烦 → Act 2 上限砍到 1 轮

---

## 9. 与 prototype-preview.html 的关系

**当前原型已实现:**
- ✅ Act 1 greeting(按时辰随机)
- ✅ Act 3 起卦动画 + 印章砸下
- ✅ Act 3 laogui 显示
- ✅ Act 5 简化版收尾

**当前原型缺:**
- ❌ **Act 2 完全跳过** — 用户问完立刻进 Act 3,没有收纳
- ❌ **Act 4 是随机池** — 没有触发器,没有移动选择逻辑
- ❌ **没有完整状态机** — 全靠 hasAskedFirst 一个 bool

**升级路径:**
1. 把现在 JS 里的逻辑改写为状态机(Phase 1)
2. 引入 `dialogue-pool.json` 资产文件(Phase 2)
3. 完善 7 大触发器关键词清单(Phase 3)
4. 接入后端 LLM 时,把硬编码的 ANSWERS 池替换为真实生成(Phase 4)

---

## 10. 一句话总结

> 这套方法论的本质是:**让小乌龟看上去像个会接话的人,而不是会出 verdict 的按钮。**

verdict 还是产品的核心英雄帧。但 verdict 之所以打动人,是因为前面有 Act 2 的「他听过我」,后面有 Act 4 的「他陪我想清楚」。

**Verdict 是仪式的高点。Act 2 是仪式的入场。Act 4 是仪式的余韵。三者缺一,这就退化成 ChatGPT。**

---

*—— v0.1 草案结束。等产品确认 9 个待定问题后定稿,再进入工程落地。*
