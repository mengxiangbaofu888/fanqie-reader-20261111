# 阅读 · 番茄排版 · AI 纠错

以开源的 [阅读（Legado）](https://github.com/gedoor/legado) 为底座，把三件事合到一个 App 里：

1. **番茄免费小说的阅读页**：翻页方式与翻页布局、页眉页脚、行距字距、段落缩进、背景色方案 —— 这是「读起来舒服」的部分；
2. **旷野书屋的全部书源与搜书能力**：133 个书源原样内置，首次启动自动导入；
3. **AI 正文纠错**：自带自己的 API Key，任意 OpenAI 兼容厂商（DeepSeek / Kimi / MiMo / 智谱 / 千问 / 豆包 / GPT / Grok / Gemini …），纠正小说里的错别字、乱码、多余的字。

版本号见仓库根目录 `VERSION`，每次改动都必须升号并在 [CHANGELOG](CHANGELOG.md) 留一节，
打 `vX.Y.Z` 标签后由 GitHub Actions 自动构建两个 ABI 的 APK 并发 Release。

---

## 一、这里有什么

| 目录 | 内容 |
|---|---|
| `VERSION` | **版本号唯一来源**。`4.1.0` 这种格式，改这里就够了 |
| `CHANGELOG.md` | 每个版本改了什么。CI 会检查「有没有对应小节」 |
| `data/` | 内置数据（全部是纯 JSON，随便 diff、随便审） |
| `data/bookSources-builtin.json` | **154 个内置书源** = 旷野 133 + XIU2 精选 20 + 原生 1 |
| `data/kuangye-bookSources-133.json` | 旷野原文 133 个书源（清洗过分组，未删改规则） |
| `data/readConfig-merged-13-dark.json` | **13 套排版预设**，含番茄配色的三态背景（正常 / 夜间 / 墨水屏） |
| `scripts/` | 构建与发版工具链，全部纯 Node，不依赖 Java 也能跑自检 |
| `patches/` | 代码层注入声明（锚点 + 替换块），底座源码本身不改 |
| `.github/workflows/release.yml` | 发版流水线 |
| `docs/` | 令牌权限清单、构建环境、底座变更记录、发版与下载 |

## 二、三块能力是怎么进去的

### 1. 番茄的阅读页（翻页 / 布局 / 配色）

番茄的阅读设置面板拆成 7 组：字号与字体、行距字距、页边距、背景色、翻页动画、页眉页脚、段落排版。
其中真正影响「手感」的是三样：

| 项 | 番茄的取值 | 阅读（底座）的对应字段 | 说明 |
|---|---|---|---|
| 翻页方式 | 覆盖 / 滑动 / 无动画 / 仿真卷曲 | `ReadStyle.pageAnim` | 底座只有前三种，第 4 种在 4.2.0 补 |
| 翻页区域 | 左右各 1/3 翻页，中间 1/3 唤菜单 | `ReadConfig.enableClick` + 三分区 | 一致 |
| 正文密度 | 行距 1.5、段间距 0.6em、首行缩进 2 字、左右边距 22dp | `lineSpacingExtra` / `paragraphSpacing` / `paragraphIndent` / `paddingLeft/Right` | **已落进 13 套预设** |

配色不是随便挑的，是从番茄的几套主题里取值后换算成底座的 ARGB：

| 预设名 | 日间背景 | 日间字色 | 夜间背景 | 夜间字色 |
|---|---|---|---|---|
| 番茄默认 | `#F7F1E3` | `#2B2B2B` | `#141414` | `#9E9E9E` |
| 番茄护眼绿 | `#C0EDC6` | `#1F2A20` | `#0E1A11` | `#96A796` |
| 微信读书 | `#FFFFFF` | `#0B0B0B` | `#000000` | `#ADADAD` |
| 墨水屏 | `#FFFFFF` | `#000000` | — | — |

> 完整 13 套在 `data/readConfig-merged-13-dark.json`，每套都带 `bgStrDark` / `textColorDark`，
> 所以切到暗色模式时字体和背景**不会糊成一片**（这是之前版本最大的坑）。

### 2. 旷野书屋书源与搜书

- 133 个源全部保留原始规则（搜索、详情、目录、正文、发现页），一个字段没删；
- 分组按旷野原样保留（`💯 精品 💯` / `🎉 精选` / `🔰 一般` / `🔥 耽美` 等），方便按质量筛；
- 内置的 154 个是「旷野 133 + 20 个精品补充」，多出来的 20 个覆盖旷野失效时的兜底；
- 搜书走底座的多源并发搜索（`SearchModel`），单个源超时不影响整体，结果按源权重排序。

### 3. AI 正文纠错

核心设计只有一条：**AI 不重写正文，只给补丁**。

```
章节原文 ──┬─→ 原文（开关关）
           └─→ AI 纠错后（开关开）
```

AI 收到的是一整章，但只允许返回：

```json
{"edits":[{"find":"因该","replace":"应该","reason":"错别字"}]}
```

本地逐条校验后才应用：

| 校验 | 不通过的处理 |
|---|---|
| `find` 必须在原文里真实存在 | 丢弃该条 |
| `find` 在原文里只能出现一次（或带上下文定位） | 出现多次则丢弃，怕改错位置 |
| 单条改动 ≤ 80 字 | 丢弃，防模型整段改写 |
| 补丁区间不能互相重叠 | 只保留先到的那一条 |

**最坏结果是「这处没纠上」，而不是「正文被改坏」。**

支持的厂商全部走 OpenAI 兼容协议（`POST {baseUrl}/chat/completions`），填 Key 即用：

| 国内 | 国外 |
|---|---|
| DeepSeek、Kimi 月之暗面、智谱 GLM、小米 MiMo、豆包火山方舟、千问通义、MiniMax、百川、阶跃星辰、硅基流动 | OpenAI、Claude（Anthropic 协议）、Gemini（OpenAI 兼容入口）、xAI Grok、OpenRouter、Mistral、Groq |

本地 Ollama 与任意中转站走「自定义」入口。

## 三、构建

### CI（推荐）

```bash
git tag v4.1.1 && git push origin v4.1.1
```

CI 会做四关：版本号一致性 → 构建 arm64/universal → 验签 + 验 ABI → 发 Release。

### 本地

```powershell
node scripts/prepare-base.js      # 拉底座源码（浅克隆，锁定在 gradle/base-source.json）
node scripts/apply-patches.js     # 注入内置数据与代码补丁
node scripts/build-local.js --abi arm64
node scripts/check.js             # 自检，不碰 Java
```

需要 JDK 17（CI 会自动补 21）与 Android SDK（compileSdk 37 / build-tools 35+），详见 [构建环境](docs/构建环境.md) 与 [底座变更](docs/底座变更.md)。

## 四、发版规矩

1. 改功能 → 改代码；
2. `npm run bump:patch`（或 minor/major）→ 自动改 `VERSION`、`build.gradle.kts`、写 `version.properties`；
3. `CHANGELOG.md` 加一节 `## [x.y.z] - 日期`，不然 CI 会红；
4. 提交、打 `vX.Y.Z` 标签、push；
5. CI 出包，Release 自动生成。

`versionCode` 规则是 `major*10000 + minor*100 + patch`，保证单调递增 —— Android 拒绝覆盖安装
低 `versionCode` 的包，这条不能乱。

## 五、许可

底座 Legado 是 GPL-3.0，本仓库的改动同样以 GPL-3.0 发布，见 [LICENSE](LICENSE)。
内置书源由第三方站点规则构成，版权归各站点所有，本项目只做格式转换与聚合。