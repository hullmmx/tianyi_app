# 「天意」数据资产说明 v3.1

> 本目录下的 JSON 文件是引擎层的关键数据资产
> 完整架构见 `../direction-v3.md`,本文档只讲 schema 与接入

---

## 文件清单

| 文件 | 用途 | 体量 |
|---|---|---|
| `hexagrams-64.json` | 64 卦数据(卦辞、爻辞、palace、element 等) | ~70 KB |
| `quotes-pool.json` | 90 条 玄学/哲学金句,带出处 | ~16 KB |
| `yongshen-keywords.json` | 用神判定的关键词查表(5 类六亲 × ~30 词) | ~4 KB |
| `blacklists.json` | 输出复检的三大黑名单 | ~6 KB |
| `fallback-laogui.json` | LLM 失败时的降级模板池(135 条) | ~10 KB |

---

## 1. hexagrams-64.json

### 接入流程(v3.1 · 六爻)

```
1. 用户提交问题 → 引擎按时间起卦得到 6 爻(老阴/老阳/少阴/少阳)
2. 派生本卦 binary 与变卦 binary(动爻位 bit 翻转)
3. 在 hexagrams[] 中按 binary 双次 find → 拿到本卦 + 变卦
4. 引擎拿出 palace + element 推导每爻六亲
5. 用神判定层定位用神在哪一爻,评估状态
6. 注入 LLM 的 facts.for_llm_reference_only 只包含 essence + tags + 用神状态
   classical 文本(judgement / image / lines[].text)不进 prompt
```

### binary 编码约定

- 6 字符字符串,**自下而上**(初爻在左,上爻在右)
- `'1'` = 阳爻 (—),`'0'` = 阴爻 (- -)
- 例:山雷颐 ䷚ = 上艮(001) + 下震(100),自下而上 = `"100001"`

### 字段含义

| 字段 | 说明 | 进 LLM prompt? |
|---|---|---|
| `id` | 1-64,文王卦序 | – |
| `name` | 中文卦名 | – |
| `pinyin` | 拼音 | – |
| `unicode` | Unicode 卦象符号 ䷀-䷿ | – |
| `trigrams.upper / lower` | 上下八卦中文名 | – |
| **`palace`** | **八宫归属(乾/坎/艮/震/巽/离/坤/兑 + 宫)** | – |
| **`element`** | **本卦五行(金/水/木/火/土)** | – |
| `binary` | 6-char 自下而上 | – |
| `judgement` | 卦辞 (classical) | ❌ **绝对不进** |
| `image` | 大象传 (classical) | ❌ **绝对不进** |
| `essence` | 现代浓缩 20-40 字 | ✅ 进 |
| `tags` | 决策关键词 3-5 个 | ✅ 进 |
| `lines[i].text` | 爻辞 (classical) | ❌ **绝对不进** |
| `lines[i].hint` | 爻含义 4-8 字 | ✅ 进(仅动爻位) |

**v3.1 与 v2 的关键变化:**
- 新增 `palace`、`element` 字段(六亲推导用)
- classical 文本(judgement / image / lines[].text)**移出 LLM prompt**——只在引擎层使用
- LLM 只看 essence + tags + 动爻 hint,避免古文意象漏到口语化输出

---

## 2. quotes-pool.json

加载页(meditate state)轮播,详细说明保留 v1 不变。

| 字段 | 说明 |
|---|---|
| `id` / `text` / `source` / `tag` / `confidence` | 见文件 _meta |

`tag` 取值:`still` / `flow` / `change` / `wait` / `self` / `act`

---

## 3. yongshen-keywords.json(新)

用神判定的第 1 层(关键词查表)。

```
输入:question (string)
对每类(妻财/官鬼/子孙/父母/兄弟)的 keywords 做 includes() 子串匹配
输出:(category, confidence)
  命中 1 类 → 0.9
  命中 2+ 类 → 0.5(送 Haiku 二次校验)
  命中 0 类 → 0.0(送 Haiku 二次校验)
  单类内命中 ≥2 词 → 0.95
```

歧义规则参见文件内 `ambiguity_rules`。

---

## 4. blacklists.json(新)

LLM 输出复检的三大黑名单,validator 用 `String.prototype.includes()` 做命中检测。

| 字段 | 用途 | 触发结果 |
|---|---|---|
| `mystic_words` | 玄学词(卦/爻/五行/天命/缘分/六亲/六神等) | 重试 |
| `forbidden_words` | 语气禁用(一定/必然/您/恭喜/加油/相信自己等) | 重试 |
| `cliche_phrases` | 套语(水到渠成/顺其自然/有志者事竟成等) | 重试 |

**operating_principle:** 黑名单是产品资产,要持续运营。每周 review LLM 触发分布,反向扩充。

---

## 5. fallback-laogui.json(新)

LLM 重试 2 次都失败时的降级模板。

```
输入:(category, verdict)
输出:从对应桶随机抽 1 条 laogui
```

桶结构:5 类六亲 + self × 3 verdict (是/否/缓) × ~8 条/桶 = 135 条。

**fallback 路径绕过 'topic_keyword 必须扣题' 的复检规则**——预生成的 fallback 已经针对 category 校准过,不需要再校验扣题。

---

## 引擎层调用顺序图

```
question + timestamp
   │
   ▼
[high-risk classifier]──→ 命中 → 静态人文关怀(不读任何数据资产)
   │
   ▼
[time-cast] → 6 爻 + 本卦/变卦 binary
   │
   ▼
[hexagrams-64.json] ───→ 双次 find → 本卦 + 变卦 (palace, element, essence, tags)
   │
   ▼
[liuqin 推导] → 6 爻配六亲
   │
   ▼
[yongshen-keywords.json] → 关键词分类 → category + confidence
                          │
                          └──→ confidence 低 → [Haiku 4.5 二次分类]
   │
   ▼
[yongshen 定位] → 用神在卦哪一爻 + 状态(动/静/化吉/化破)
   │
   ▼
[prompt 组装] → facts JSON 双层化 → System Prompt
   │
   ▼
[Sonnet 4.6 调用] → {verdict, laogui}
   │
   ▼
[blacklists.json] ──→ validator 三大黑名单 + 字数 + 扣题校验
   │
   ├── 通过 → 返回客户端
   ├── 失败 → 重试(最多 2 次)
   └── 3 次都失败 ──→ [fallback-laogui.json] → 兜底返回
```

---

## 上线前必做

- [ ] hexagrams-64.json 的 64 个 palace + element 校对(已自动生成,需玄学顾问签字)
- [ ] yongshen-keywords.json 5 类 × ~30 词,玄学顾问 review,补漏
- [ ] blacklists.json 三大列表跑 100 条常见 laogui 不被误伤
- [ ] fallback-laogui.json 135 条产品再 review 一遍,任何一条不烂为止
- [ ] quotes-pool.json 中 confidence: med 的 3 条出处确认或替换

---

## 与其他文件的关系

```
data/
├── hexagrams-64.json          ← 64 卦核心数据
├── quotes-pool.json           ← 加载页轮播
├── yongshen-keywords.json     ← 用神判定第 1 层
├── blacklists.json            ← 复检黑名单
├── fallback-laogui.json       ← 降级兜底
└── README.md                  ← 本文件

../assets/
└── turtle-poses.svg           ← 老龟视觉资产

../prototype-preview.html      ← 互动原型(待按 v3.1 重做揭晓页)
../direction-v3.md             ← 产品与架构定稿(主文档)
../api/divine.ts               ← 引擎实现(待按 v3.1 重写)
```

---

*—— v3.1 数据 schema 文档结束 ——*
