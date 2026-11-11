# 更新日志

版本策略：`MAJOR.MINOR.PATCH`，版本号唯一来源是仓库根目录的 `VERSION` 文件。
每次发版执行 `node scripts/bump-version.js <major|minor|patch>`，提交后打 `vX.Y.Z` 标签，
GitHub Actions 自动构建并发布。

## [4.1.0] - 2026-11-11

### 建仓首版

- 建立正式仓库，把此前散落的三类成果收拢为可持续迭代的工程：
  - 番茄免费小说的阅读页排版（翻页、页眉页脚、行距字距、背景色、13 套预设）；
  - 旷野书屋的 133 个书源与搜书链路；
  - 阅读（Legado）底座 + AI 正文纠错（多厂商，自填 API Key）。
- 版本号单一来源：`VERSION` → `app/build.gradle.kts` → `version.properties`（构建期生成）。
- 新增发版流水线 `.github/workflows/release.yml`：打 tag 自动构建 arm64 + universal 两个 APK，
  用仓库密钥签名并上传到 GitHub Release。
- 新增 `scripts/` 工具链：拉源码、注入内置数据、改版本、构建、校验签名。

## [4.1.1] - 2026-11-11

### 修

- **versionCode 恒为 32640**：底座默认值兜底把版本号吃掉了，导致 4.1.0 与任何后续版本
  在 Android 眼里都是同一个 versionCode，覆盖安装会被拒。现在 CI 显式把
  `max(32640, 40000 + minor*100 + patch)` 写进 `COMMIT_NUMBER`。
- 附件文件名带中文会被 GitHub 清洗成 `-.-xxx.apk`，改为纯 ASCII 名 + 正文中文对照表。

### 说明

- 这一版**仍是同一个包名** `io.legato.kazusa`，与 4.1.0 可以互相覆盖（同签名）。
- 与 3.99.x / 4.00.x（`io.legado.app.release`）依然无法覆盖，需并存安装。

## [未发布的待办]

- 4.2.0：番茄阅读页的翻页动画逐帧对齐（curl / 上下滑动 / 覆盖 / 无动画四档的插值曲线）。
- 4.3.0：AI 纠错结果落盘缓存（当前仅内存），支持整本预纠错。
- 4.4.0：书源健康度检测面板（批量探活 + 自动禁用失效源）。
