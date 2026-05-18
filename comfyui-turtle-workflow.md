# 老龟 ComfyUI 视觉资产生成工作流 v1.0

> 把现在那只几何 SVG 老龟,升级为水墨手绘风的「同一只老龟在做不同事」的 8 张姿态。
> 配合 `prototype-preview.html` 当前的时辰活动系统,直接替换 SVG 即用。

---

## 0. 这事大概要花你多少时间钱

| 阶段 | 时间 | 成本 |
|---|---|---|
| 环境搭建(本地) | 2-4 小时 | 0(已有 GPU) |
| 环境搭建(云端) | 30 分钟 | $0(注册时通常送) |
| 主图设计 + 锁定 | 2-3 小时 | $1-2(云) |
| 8 张活动姿态 | 2-3 小时 | $1-2(云) |
| 抠图 + 导出 | 1 小时 | 0 |
| 集成回项目 | 30 分钟 | 0 |
| **总计** | **1 天** | **$2-5**(云) |

**最便宜可行路径:RunPod 租 RTX 4090,1 小时 $0.40-0.70,做完整套 < $3。**

---

## 1. 部署 ComfyUI

### 选项 A · 本地 Windows(适合有 GPU + 长期使用)

**1.1 检查 GPU**

PowerShell 跑:
```powershell
nvidia-smi
```

看显存。**要求:**
- Flux Dev:**12GB VRAM+**(RTX 3060 12GB / 4060 Ti 16GB / 4070+)
- Flux Schnell(更快但质量略低):**8GB VRAM+**
- SDXL(质量够用,显存最低):**6GB VRAM+**

如果是 AMD / Intel / 集显,**走选项 B**。

**1.2 下载 ComfyUI Portable**

[github.com/comfyanonymous/ComfyUI/releases](https://github.com/comfyanonymous/ComfyUI/releases) 最新 release →
下载 `ComfyUI_windows_portable_nvidia.7z`(约 2GB)→
用 7-Zip 解压到 `D:\ComfyUI`(或任意位置)

**1.3 启动**

进入 `D:\ComfyUI`,双击 **`run_nvidia_gpu.bat`**
浏览器自动开 `http://127.0.0.1:8188`,看到默认工作流就成功。

---

### 选项 B · 云端 RunPod(推荐没有 GPU 的人,也是最快上手路径)

**1.1 注册**
[runpod.io](https://www.runpod.io/) → 邮箱注册 → 充值 $5(用不完)

**1.2 部署 Pod**
左侧 **Pods** → **Deploy** → 选 **RTX 4090**(约 $0.40/h)→
Template 搜索 **"ComfyUI"** → 选 **"ComfyUI by AshleyKlevner"** 或同类官方模板 →
**Deploy On-Demand**

**1.3 连接**
等 2-3 分钟,Pod 状态变 Running →
点 **Connect** → 选 **"HTTP Service [Port 8188]"** →
浏览器打开 ComfyUI 界面

**1.4 用完记得停**
左侧 Pods → 点 Stop(不删除磁盘),下次再用直接 Start。**忘关 24h 也就 $10**。

---

## 2. 下载模型文件

ComfyUI 装好后,需要往 `models/` 各目录放对应文件。

### 必装(主模型 + 编码器)

| 文件 | 放哪儿 | 大小 | 下载 |
|---|---|---|---|
| `flux1-dev-fp8.safetensors` | `models/checkpoints/` | ~12GB | [HuggingFace](https://huggingface.co/Comfy-Org/flux1-dev/blob/main/flux1-dev-fp8.safetensors) |
| `t5xxl_fp8_e4m3fn.safetensors` | `models/clip/` | ~5GB | [HF](https://huggingface.co/comfyanonymous/flux_text_encoders/blob/main/t5xxl_fp8_e4m3fn.safetensors) |
| `clip_l.safetensors` | `models/clip/` | ~250MB | [HF](https://huggingface.co/comfyanonymous/flux_text_encoders/blob/main/clip_l.safetensors) |
| `ae.safetensors` | `models/vae/` | ~340MB | [HF](https://huggingface.co/black-forest-labs/FLUX.1-schnell/blob/main/ae.safetensors) |

**云端用 RunPod 的话:** 大多数 ComfyUI 模板已经预装了 Flux,跳过这一步。在文件浏览器看 `models/checkpoints/` 有没有 flux1-dev 即可。

### 风格 LoRA(关键,决定水墨味)

去 [civitai.com](https://civitai.com/) 搜索:

- **"Chinese ink painting flux"** — 选 stars 最多的(通常 200+ 个赞)
- 或 **"水墨 Flux"** / **"sumi-e flux"** / **"ink wash flux"**
- 或具体推荐:**"shuimo Flux"** by lyumin
- 下载 `.safetensors` 文件 → 放 `models/loras/`

### 角色一致性(IP-Adapter)

[github.com/XLabs-AI/x-flux](https://github.com/XLabs-AI/x-flux) 下:
- `flux-ip-adapter.safetensors` → `models/ipadapter/`(如果目录不存在,自己建)
- 安装 IPAdapter Plus 节点:ComfyUI Manager 搜 "ComfyUI-IPAdapter-Plus"

### (可选)构图控制 ControlNet

[HF: XLabs-AI/flux-controlnet-collections](https://huggingface.co/XLabs-AI/flux-controlnet-collections) →
下 `flux-canny-controlnet-v3.safetensors` 或 `flux-scribble-controlnet-v3.safetensors` →
放 `models/controlnet/`

---

## 3. 主图设计(关键第一步)

这一步要出 **1 张「老龟身份模板」**,后续 7 张都以它为锚点保持一致。

### 3.1 简版工作流(纯文生图,先跑通)

ComfyUI 界面双击空白处,搜索并加入这些节点:

```
Load Diffusion Model    → 选 flux1-dev-fp8.safetensors
DualCLIPLoader          → clip1: t5xxl_fp8_e4m3fn  clip2: clip_l
Load VAE                → 选 ae.safetensors
EmptyLatentImage        → width 1024, height 1024, batch_size 4
CLIP Text Encode (Positive)
CLIP Text Encode (Negative)
KSampler                → steps 28, cfg 4.5, sampler dpmpp_2m, scheduler sgm_uniform
VAE Decode
Save Image
```

加 LoRA:
```
LoraLoader               → 选水墨 LoRA, strength_model 0.9, strength_clip 0.9
```
把它串在 Load Diffusion Model 和 KSampler 之间。

### 3.2 主图 Positive Prompt(直接复制粘贴)

```
ink wash painting in traditional Chinese sumi-e style, single
elderly wise turtle sage, soft gentle squinting eyes with kind
half-smile expression, three long flowing white beard wisps of
varying length, weathered hexagonal shell pattern faintly
visible, sitting cross-legged in serene meditation pose,
side profile facing right, master Oogway essence mixed with
八大山人 minimalist brushwork, loose ink bleeding into rice paper,
sumi-e technique with calligraphic brush strokes, soft cream rice
paper background with subtle xuan paper texture, dignified yet
warm aged presence, contemplative atmosphere, gentle natural
lighting from upper left, isolated figure occupying center,
ample empty whitespace, Studio Ghibli warmth meets traditional
Chinese painting
```

### 3.3 Negative Prompt(避坑用)

```
photographic, photorealistic, 3D render, CGI, modern, digital art,
cartoon, anime, chibi, kawaii, bright saturated colors, neon,
harsh outlines, geometric shapes, plastic, glossy surface,
multiple turtles, baby turtle, sea turtle, beach, ocean water,
human figure, anthropomorphic clothing, weapons, action fighting
pose, busy composition, cluttered background, text watermark logo
signature, deformed features, low quality, blurry, jpeg artifacts,
overexposed, harsh shadows
```

### 3.4 参数 cheat sheet

```
Resolution:   1024 × 1024
Steps:        28-32
CFG:          4.5 (Flux 偏好低 CFG)
Sampler:      dpmpp_2m
Scheduler:    sgm_uniform
Seed:         随机
Batch size:   4-8(一次出多张挑)
LoRA weight:  0.8-1.0(看 LoRA 强度调)
```

### 3.5 跑 → 挑 → 锁

跑 batch 8,总共出 16-32 张。挑选标准:

- ✅ 眼神温和,半眯眼,有「见过事」的从容
- ✅ 胡须 3-5 缕,水墨晕染感强,不死板
- ✅ 龟壳 hexagonal 隐约可见但不刻意
- ✅ 整体姿态从容,不紧张
- ✅ 留白充足,主体占画面 40-50%
- ❌ 眼睛太大或眼神锐利(像猛兽不是智者)
- ❌ 胡须像「圣诞老人」(太洋,太浓密)
- ❌ 像龙猫 / 像兔子 / 像甲虫(身份漂移)

**挑中的这张保存为 `turtle-base.png`**。这是后续 7 张姿态的「身份模板」。

---

## 4. 锁住老龟身份(IP-Adapter 工作流)

不训 LoRA(那个要 100+ 样本)。用 **IP-Adapter** 把主图当「角色参考」喂模型。

### 4.1 加节点

在主图工作流基础上加:

```
LoadImage              → 选 turtle-base.png
IPAdapterModelLoader   → 选 flux-ip-adapter.safetensors
IPAdapterAdvanced      → weight 0.7, weight_type "linear"
```

把 `IPAdapterAdvanced` 的 `model` 输出接到 `KSampler` 的 `model` 输入。原 LoRA / model 输出先过 IPAdapter,再进 sampler。

### 4.2 调 weight

跑一次「主图 prompt + 同时启用 IP-Adapter」,看输出是不是「这只老龟」:

- **0.5**:相似度低,容易跑形
- **0.7**:**推荐**(身份强,姿态变化还能跟 prompt 走)
- **0.85**:几乎复刻主图,姿态难变
- **1.0**:可能糊

调到能稳定看出「同一只老龟」就够。

---

## 5. 8 张活动姿态 prompts

**通用 base**(每张都保留这一段):

```
ink wash painting of the same elderly wise turtle from reference,
gentle squinting eyes, long flowing white beard wisps, traditional
sumi-e brushwork, weathered hexagonal shell visible, soft cream
rice paper background, isolated composition with ample whitespace,
loose ink bleeding into paper, contemplative serene mood
```

加上各自的活动描述:

### 5.1 打盹 sleeping
```
[base], turtle is dozing with eyes fully closed, head slightly
tucked into shell, peaceful sleeping expression, three subtle
small calligraphy "Z" characters floating above with brush strokes,
late night moonlit mood, soft cool blue tones, lying restful pose
```

### 5.2 练拳 practice
```
[base], turtle in slow flowing tai chi pose, one front leg extended
gracefully forward in a circular motion, the other leg planted,
eyes half-open with focused inner calm, early dawn mist at base,
mountain peak silhouette faint in far background, energy of qi
```

### 5.3 烹茶 tea
```
[base], turtle sitting beside a small clay teapot, single ceramic
tea cup in front, a delicate wisp of steam rising in fluid brush
strokes, turtle gazing thoughtfully at the steam, morning sunlight
through paper window, zen tea ceremony atmosphere
```

### 5.4 读书 reading
```
[base], turtle reading an unfurled bamboo scroll spread on the
ground before him, head bent slightly forward in concentration,
one front leg gently holding scroll's edge, quiet midday light,
some ancient characters faintly visible on scroll
```

### 5.5 教小徒弟 teaching
```
[base], turtle teaching a small young sparrow disciple perched
on a flat stone before him, calligraphy brush in turtle's front
leg pointing at a piece of rice paper between them, sparrow
attentively watching with eager bright eyes, afternoon golden
light, mentor and student composition, two-figure scene
```

### 5.6 看湖 lake
```
[base], turtle sitting on a flat stone at the edge of a still lake,
gazing contemplatively toward distant water, gentle ripples
suggested by minimal horizontal ink strokes, faint reflection
beneath him, dusk golden orange light, horizon line visible,
small fishing pole optional resting against stone
```

### 5.7 听雨 rain
```
[base], turtle sitting peacefully under a sparse bare tree branch,
eyes closed listening intently, gentle rain falling as light
diagonal ink dashes from above, subtle wet shimmer on ground,
slight color tone of cool gray-blue evening, intimate listening mood
```

### 5.8 落笔写字 writing
```
[base], turtle holding a calligraphy brush in front leg, poised
deliberately over a sheet of rice paper, small oil lamp nearby
casting warm amber glow, ink stone with grinding stick beside,
late night writing session, peaceful focused expression, warm
candlelight tones contrasting with night air
```

---

## 6. 批量生成 + 挑选

每个活动跑 **batch 8**,挑最强的 1 张。挑选标准:

- 老龟身份保持(脸、胡须长度方向、龟壳特征 vs 主图)
- 活动元素清晰但不喧宾夺主(茶杯不能比龟还大)
- 整体仍是「ink wash + minimal」的调性
- 留白充足,主体居中略偏

不满意就调 IP-Adapter weight 或微改 prompt 再跑。

---

## 7. 后期 · 抠图 + 切尺寸

### 7.1 抠图(透明背景)

**方法 A · ComfyUI 内置抠图**

加节点:
```
BRIA RemBG   或   InspyrenetRembg
```

接到 VAE Decode 后,自动去掉米色背景 → 输出 RGBA PNG。

**方法 B · 在线一键**

去 [remove.bg](https://www.remove.bg/) 或 [bg.eraser.io](https://bg.eraser.io/) 单张上传抠图。每张 5 秒。

### 7.2 切尺寸(响应式)

每张导出 3 个版本:

| 倍率 | 尺寸 | 用途 |
|---|---|---|
| @1x | 380 × 304 px | 普通屏 |
| @2x | 760 × 608 px | retina(默认) |
| @3x | 1140 × 912 px | 高清屏 |

用 [squoosh.app](https://squoosh.app/) 或 Photoshop 的 Export As 一次性导出。

### 7.3 文件命名

```
assets/turtle/
├── sleeping@1x.png   sleeping@2x.png   sleeping@3x.png
├── practice@1x.png   practice@2x.png   practice@3x.png
├── tea@1x.png        tea@2x.png        tea@3x.png
├── reading@1x.png    reading@2x.png    reading@3x.png
├── teaching@1x.png   teaching@2x.png   teaching@3x.png
├── lake@1x.png       lake@2x.png       lake@3x.png
├── rain@1x.png       rain@2x.png       rain@3x.png
└── writing@1x.png    writing@2x.png    writing@3x.png
```

24 张 PNG,总大小约 5-10 MB。

---

## 8. 集成回项目(替换 SVG)

打开 `prototype-preview.html`,找到 `<div class="turtle-stage">...</div>` 那段(大概 80 行 SVG path),整段替换成:

```html
<div class="turtle-stage">
  <img class="turtle-img" id="turtle-img"
       src="assets/turtle/sleeping@2x.png"
       srcset="assets/turtle/sleeping@1x.png 1x,
               assets/turtle/sleeping@2x.png 2x,
               assets/turtle/sleeping@3x.png 3x"
       alt="老龟">
</div>
```

CSS 删掉所有 `.turtle [data-ink]` / `[data-shell]` / `[data-skin]` / `[data-eye-*]` 那一大堆(用不上了),换成:

```css
.turtle-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 28px rgba(232, 201, 122, 0.22));
  transition: filter 2000ms, opacity 600ms;
  user-select: none;
  pointer-events: none;
}
body.dawn .turtle-img {
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.08));
}
```

JS 更新 `renderActivity()`:

```js
function renderActivity() {
  const a = getCurrentActivity();
  $activityCaption.textContent = ACTIVITY_CAPTION[a];
  $tapHint.textContent          = ACTIVITY_HINT[a];

  // 切老龟图片
  const $img = document.getElementById('turtle-img');
  $img.src = `assets/turtle/${a}@2x.png`;
  $img.srcset = `assets/turtle/${a}@1x.png 1x,
                 assets/turtle/${a}@2x.png 2x,
                 assets/turtle/${a}@3x.png 3x`;

  // ZZZ 只在 sleeping 时显示
  document.getElementById('zzz-stage').style.opacity = (a === 'sleeping') ? '' : '0';
}
```

之前 SVG 老龟那 600 行 path 全可以删,代码量反而少了 80%。

---

## 9. 常见坑

**Q: 我没 NVIDIA GPU 怎么办**
A: RunPod $0.40-0.70/h 跑 4090,完整套 < $3。比买卡划算。

**Q: 角色一致性不够,8 张像 8 只乌龟**
- IP-Adapter weight 提到 0.85
- 主图选「特征更明显」的(胡须 3 缕、龟壳花纹有辨识度)
- Prompt 加具体特征:`"same turtle with three long beard wisps of distinctive length, same weathered hexagonal shell pattern"`

**Q: 水墨味不够,看起来太「卡通」**
- 加强水墨 LoRA(weight 1.0+)
- Prompt 加:`"loose brushwork, ink bleeding into paper, sumi-e technique, dry brush texture"`
- CFG 降到 3.5(让模型更自由)

**Q: 主体太大,留白不够**
- 加 prompt:`"distant view, isolated figure occupying only 35% of canvas, vast empty negative space, generous whitespace"`

**Q: 跑出来背景全是花花的**
- 加 negative:`"cluttered background, busy environment, multiple objects, scenery"`
- 加 positive:`"clean minimal background, pure rice paper, empty space"`

**Q: 一张要跑多久**
- 本地 RTX 4070 / 4090:30-50 秒/张
- RunPod 4090:30 秒/张
- Flux Schnell(快版):10-15 秒/张

---

## 10. 后续扩展(Phase C 及以后)

主图 + 8 姿态稳定后,可以无成本扩展:

- **24 节气特例:** 立春播一粒种 / 清明扫故友墓 / 中秋敬月 / 冬至围炉
- **节日彩蛋:** 除夕守岁 / 元宵看灯 / 端午看龙舟 / 七夕望星
- **小麻雀的故事线:** 单独生成小麻雀的 4-5 张姿态,做成「徒弟成长」彩蛋
- **天气联动:** 调用天气 API,雨天看见老龟在屋檐下,雪天看见他扫雪
- **暗夜/晨光两套图:** 主活动各做暗版 + 亮版,产品 dawn 模式时自动切

每加一种变体 = 一次 prompt 调整 + 一次抠图。半小时内一张新图。

---

*—— 工作流文档结束 ——*
