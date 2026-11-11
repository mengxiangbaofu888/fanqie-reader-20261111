#!/usr/bin/env node
/**
 * 构建产物收集：从底座的 gradle 输出目录里挑出 ABI 包，按本仓库命名规范改名。
 *
 * 底座的产物结构（flavor = mode × engine，splits 打开时会分 ABI）：
 *   app/build/outputs/apk/appCore/release/
 *       app-appCore-arm64-v8a-release.apk
 *       app-appCore-armeabi-v7a-release.apk
 *       app-appCore-universal-release.apk
 *
 * 用法：
 *   node scripts/collect-apk.js --suffix arm64 --version 4.1.0
 *   node scripts/collect-apk.js --suffix universal --version 4.1.0
 *   node scripts/collect-apk.js --list           # 只列不复制
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_OUT = path.join(ROOT, 'build', 'base', 'legado', 'app', 'build', 'outputs');
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

function pick(candidates, suffix) {
  // 排除 debug / unsigned
  const usable = candidates.filter(
    (p) => !/debug/i.test(p) && !/unsigned/i.test(p) && /release/i.test(p)
  );
  if (!usable.length) return null;

  if (suffix === 'arm64') {
    return usable.find((p) => /arm64-v8a/i.test(path.basename(p))) || null;
  }
  if (suffix === 'universal') {
    // 优先取 universal，其次取蔽掉 ABI 后缀的那个（不拆分时的产物）
    return (
      usable.find((p) => /universal/i.test(path.basename(p))) ||
      usable.find((p) => !/(arm64-v8a|armeabi-v7a|x86|x86_64)/i.test(path.basename(p))) ||
      usable[0]
    );
  }
  return usable[0];
}

function main() {
  const suffix = arg('suffix', 'universal');
  const version = arg('version', '0.0.0');
  const label = arg('label', '番茄排版');
  const listOnly = process.argv.includes('--list');

  const all = walk(BASE_OUT);
  console.log(`== 候选 APK ${all.length} 个 ==`);
  for (const p of all) {
    const kb = (fs.statSync(p).size / 1024).toFixed(0);
    console.log(`  ${path.relative(BASE_OUT, p)}  (${kb} KB)`);
  }
  if (listOnly) return;

  const src = pick(all, suffix);
  if (!src) {
    console.error(`没找到匹配 ${suffix} 的 release APK`);
    process.exit(1);
  }

  fs.mkdirSync(DIST, { recursive: true });
  const outName = `阅读-${label}-${suffix}-${version}.apk`;
  const dst = path.join(DIST, outName);
  fs.copyFileSync(src, dst);
  const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(2);
  console.log(`\n选出: ${path.relative(BASE_OUT, src)}`);
  console.log(`输出: dist/${outName}  (${mb} MB)`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}