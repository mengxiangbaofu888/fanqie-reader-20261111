#!/usr/bin/env node
/**
 * 版本号工具 —— 全仓库唯一的版本号入口。
 *
 * 用法：
 *   node scripts/bump-version.js            # 查看当前版本
 *   node scripts/bump-version.js patch      # 4.1.0 -> 4.1.1
 *   node scripts/bump-version.js minor      # 4.1.0 -> 4.2.0
 *   node scripts/bump-version.js major      # 4.1.0 -> 5.0.0
 *   node scripts/bump-version.js 4.2.3      # 直接指定
 *
 * 写回三处：
 *   1. 根目录 VERSION
 *   2. app/build.gradle.kts 的 versionName / versionCode
 *   3. 生成 app/src/main/assets/version.properties（运行时读，用于「关于」页与更新检查）
 *
 * versionCode 规则：major*10000 + minor*100 + patch
 *   例：4.1.0 -> 40100，4.10.3 -> 41003。必须单调递增，否则 Android 拒绝覆盖安装。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const GRADLE_FILE = path.join(ROOT, 'app', 'build.gradle.kts');
const PROPS_FILE = path.join(ROOT, 'app', 'src', 'main', 'assets', 'version.properties');

function readVersion() {
  const raw = fs.readFileSync(VERSION_FILE, 'utf8').trim();
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(raw);
  if (!m) throw new Error(`VERSION 内容不合法: "${raw}"（应为 MAJOR.MINOR.PATCH）`);
  return { major: +m[1], minor: +m[2], patch: +m[3], text: raw };
}

function toCode(v) {
  return v.major * 10000 + v.minor * 100 + v.patch;
}

function bump(v, kind) {
  const next = { ...v };
  if (kind === 'patch') { next.patch += 1; }
  else if (kind === 'minor') { next.minor += 1; next.patch = 0; }
  else if (kind === 'major') { next.major += 1; next.minor = 0; next.patch = 0; }
  else {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(kind);
    if (!m) throw new Error(`未知的版本标识: ${kind}`);
    next.major = +m[1]; next.minor = +m[2]; next.patch = +m[3];
  }
  next.text = `${next.major}.${next.minor}.${next.patch}`;
  return next;
}

function writeVersion(v) {
  const code = toCode(v);

  fs.writeFileSync(VERSION_FILE, v.text + '\n', 'utf8');

  let gradle = fs.readFileSync(GRADLE_FILE, 'utf8');
  const before = gradle;
  gradle = gradle.replace(/versionCode\s*=\s*\d+/, `versionCode = ${code}`);
  gradle = gradle.replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${v.text}"`);
  if (gradle === before) {
    throw new Error('app/build.gradle.kts 里没找到 versionCode/versionName，先跑 scripts/prepare-base.js');
  }
  fs.writeFileSync(GRADLE_FILE, gradle, 'utf8');

  fs.mkdirSync(path.dirname(PROPS_FILE), { recursive: true });
  fs.writeFileSync(
    PROPS_FILE,
    [
      `versionName=${v.text}`,
      `versionCode=${code}`,
      `buildTime=${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8'
  );

  return code;
}

// GitHub Actions 里用来把版本写进输出变量
function emitGithubOutputs(v, code) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  fs.appendFileSync(out, `version=${v.text}\nversion_code=${code}\ntag=v${v.text}\n`, 'utf8');
}

function main() {
  const arg = process.argv[2];
  const cur = readVersion();
  if (!arg || arg === '--show') {
    console.log(`当前版本 ${cur.text} (versionCode ${toCode(cur)})`);
    return;
  }
  const next = bump(cur, arg);
  if (toCode(next) <= toCode(cur) && !arg.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error(`新版本 ${next.text} 不大于当前 ${cur.text}`);
  }
  const code = writeVersion(next);
  emitGithubOutputs(next, code);
  console.log(`版本 ${cur.text} (${toCode(cur)}) -> ${next.text} (${code})`);
}

if (require.main === module) main();
module.exports = { readVersion, writeVersion, toCode, bump };