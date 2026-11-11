#!/usr/bin/env node
/**
 * 构建产物收集：从底座的输出目录里挑出 release APK，按本仓库命名规范改名。
 *
 * 用法（CI 里被调用）：
 *   node scripts/collect-apk.js --suffix arm64 --version 4.1.0
 *   node scripts/collect-apk.js --suffix universal --version 4.1.0
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'build', 'base', 'legado');
const DIST = path.join(ROOT, 'dist');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.apk')) out.push(p);
  }
  return out;
}

function main() {
  const suffix = arg('suffix', 'universal');
  const version = arg('version', '0.0.0');
  const label = arg('label', '番茄排版');

  const candidates = walk(path.join(BASE_DIR, 'app', 'build', 'outputs', 'apk'))
    .filter((p) => /release/i.test(p) && !/unsigned/i.test(p));
  if (!candidates.length) {
    console.error('没找到 release APK，检查底座构建是否成功');
    process.exit(1);
  }

  fs.mkdirSync(DIST, { recursive: true });
  let n = 0;
  for (const src of candidates) {
    const isPerAbi = /arm64|armeabi|x86/i.test(path.basename(src));
    // 单 ABI 构建会产出大量按 ABI 命名的包，这里按 suffix 过滤
    if (suffix === 'arm64' && isPerAbi && !/arm64/i.test(src)) continue;
    const outName = `阅读-${label}-${suffix}-${version}.apk`;
    const dst = path.join(DIST, outName);
    fs.copyFileSync(src, dst);
    const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(2);
    console.log(`${src}  ->  dist/${outName}  (${mb} MB)`);
    n++;
    break;
  }
  if (!n) {
    console.error('过滤后没有可用 APK');
    process.exit(1);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}