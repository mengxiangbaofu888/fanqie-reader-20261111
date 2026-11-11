#!/usr/bin/env node
/**
 * 把本仓库的 VERSION 落到「底座源码」里，并检查底座是否真能构建。
 *
 * 底座（阅读/Legado 派生）的版本号不在 build.gradle.kts 里写死，而是：
 *   app/version.properties  →  VERSION_MAJOR / MINOR / PATCH
 *   app/build.gradle.kts    →  versionName = System.getenv("APP_VERSION_NAME") ?: projectVersionName
 *                              versionCode = System.getenv("COMMIT_NUMBER")?.toInt()?.let { 10000 + it } ?: 32640
 *
 * 所以只需写 version.properties，versionCode 由 workflow 里的 COMMIT_NUMBER 给。
 *
 * 用法：
 *   node scripts/patch-base-version.js            # 用根 VERSION
 *   node scripts/patch-base-version.js 4.1.2      # 指定
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { readVersion } = require('./bump-version.js');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'build', 'base', 'legado');
const VP = path.join(BASE, 'app', 'version.properties');

function main() {
  const arg = process.argv[2];
  const v = arg ? { text: arg, ...parseVer(arg) } : readVersion();
  if (!fs.existsSync(BASE)) throw new Error('底座不存在，先跑 node scripts/prepare-base.js');

  let content;
  if (fs.existsSync(VP)) {
    content = fs.readFileSync(VP, 'utf8');
  } else {
    content = 'VERSION_MAJOR=0\nVERSION_MINOR=0\nVERSION_PATCH=0\nVERSION_SUFFIX=0\n# 1 = Pre, 0 = Release\n';
  }

  content = content
    .replace(/^VERSION_MAJOR=.*$/m, `VERSION_MAJOR=${v.major}`)
    .replace(/^VERSION_MINOR=.*$/m, `VERSION_MINOR=${v.minor}`)
    .replace(/^VERSION_PATCH=.*$/m, `VERSION_PATCH=${v.patch}`)
    .replace(/^VERSION_SUFFIX=.*$/m, 'VERSION_SUFFIX=0');

  fs.writeFileSync(VP, content, 'utf8');
  console.log(`[底座版本] app/version.properties -> ${v.major}.${v.minor}.${v.patch}`);
  console.log(content.trim());

  // 校验 build.gradle.kts 确实读取这个文件
  const g = path.join(BASE, 'app', 'build.gradle.kts');
  const gradle = fs.readFileSync(g, 'utf8');
  const checks = [
    ['versionPropsFile', /versionPropsFile\s*=\s*file\("version\.properties"\)/],
    ['APP_VERSION_NAME', /APP_VERSION_NAME/],
    ['COMMIT_NUMBER', /COMMIT_NUMBER/],
  ];
  for (const [name, re] of checks) {
    console.log(`${re.test(gradle) ? '✓' : '✗'} build.gradle.kts 含 ${name}`);
    if (!re.test(gradle)) {
      throw new Error(`底座 build.gradle.kts 结构变了（缺 ${name}），需要同步更新本脚本`);
    }
  }

  // applicationId 变更记录（底座已被改成 io.legato.kazusa，与早期包不同）
  const pkg = /applicationId\s*=\s*"([^"]+)"/.exec(gradle);
  if (pkg) console.log(`[包名] applicationId = ${pkg[1]}`);
}

function parseVer(t) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(t);
  if (!m) throw new Error(`版本号格式不对: ${t}`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('失败: ' + e.message); process.exit(1); }
}