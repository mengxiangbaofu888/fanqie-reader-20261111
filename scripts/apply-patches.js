#!/usr/bin/env node
/**
 * 把「番茄阅读页 + 旷野书源 + AI 纠错」三块能力注入底座源码树。
 *
 * 设计原则：底座源码保持干净可用 git diff 对照，本仓库的改动全部是
 * build/base/legado 之外的独立资产 + 有限几处精确锚点替换：
 *
 *   1. 资源层（全量覆盖）：data/*.json  ->  app/src/main/assets/
 *   2. 代码层（锚点注入）：patches/ 里的每个 patch 声明 target/锚点/替换块
 *   3. 白名单：每次注入写 build/patched-files.txt，供 rollback 使用
 *
 * patchers 定义见 patches/manifest.json。
 *
 * 用法：
 *   node scripts/apply-patches.js
 *   node scripts/apply-patches.js --dry-run
 *   node scripts/apply-patches.js --rollback
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'build', 'base', 'legado');
const DATA_DIR = path.join(ROOT, 'data');
const PATCH_DIR = path.join(ROOT, 'patches');
const MANIFEST = path.join(PATCH_DIR, 'manifest.json');
const PATCHED_LIST = path.join(ROOT, 'build', 'patched-files.txt');

function ensureBase() {
  if (!fs.existsSync(BASE_DIR)) {
    throw new Error('底座源码不存在，先跑: node scripts/prepare-base.js');
  }
}

function copyAssets(dry) {
  const dest = path.join(BASE_DIR, 'app', 'src', 'main', 'assets');
  fs.mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const name of fs.readdirSync(DATA_DIR)) {
    if (!name.endsWith('.json')) continue;
    const src = path.join(DATA_DIR, name);
    // 内置书源与排版预设交给底座自带的 assets 读取逻辑；命名保持与上游一致
    const outName =
      name === 'bookSources-builtin.json' ? 'bookSources.json' :
      name === 'readConfig-merged-13-dark.json' ? 'readConfig.json' :
      name;
    const dst = path.join(dest, outName);
    const bytes = fs.statSync(src).size;
    if (dry) {
      console.log(`[dry] 资源 ${name} -> assets/${outName} (${(bytes / 1024).toFixed(1)} KB)`);
    } else {
      fs.copyFileSync(src, dst);
      console.log(`[资源] assets/${outName} (${(bytes / 1024).toFixed(1)} KB)`);
    }
    copied.push(outName);
  }
  return copied;
}

function applyAnchoredPatches(dry) {
  if (!fs.existsSync(MANIFEST)) {
    console.log('[补丁] 没有 patches/manifest.json，跳过代码层注入');
    return [];
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const touched = [];

  for (const p of manifest.patches) {
    if (p.disabled) continue;
    const target = path.join(BASE_DIR, p.target);
    if (!fs.existsSync(target)) {
      console.warn(`[跳过] 目标不存在: ${p.target}`);
      continue;
    }
    let text = fs.readFileSync(target, 'utf8');

    if (p.mode === 'append-block') {
      const block = fs.readFileSync(path.join(PATCH_DIR, p.block), 'utf8');
      if (text.includes(p.marker)) {
        console.log(`[已注入] ${p.target} (${p.marker})`);
        continue;
      }
      const idx = text.indexOf(p.anchor);
      if (idx < 0) {
        console.warn(`[跳过] 锚点未命中 ${p.target}: ${p.anchor}`);
        continue;
      }
      const at = idx + p.anchor.length;
      const next = text.slice(0, at) + '\n' + p.marker + '\n' + block + '\n// </' + p.marker + '>\n' + text.slice(at);
      if (!dry) fs.writeFileSync(target, next, 'utf8');
      console.log(`[注入] ${p.target} <- ${p.block}`);
      touched.push(p.target);
    } else if (p.mode === 'replace') {
      const from = fs.readFileSync(path.join(PATCH_DIR, p.from), 'utf8');
      const to = fs.readFileSync(path.join(PATCH_DIR, p.to), 'utf8');
      if (!text.includes(from)) {
        console.warn(`[跳过] 原文未命中 ${p.target}`);
        continue;
      }
      if (!dry) fs.writeFileSync(target, text.replace(from, to), 'utf8');
      console.log(`[替换] ${p.target}`);
      touched.push(p.target);
    }
  }
  return touched;
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  ensureBase();

  if (args.includes('--rollback')) {
    if (!fs.existsSync(PATCHED_LIST)) { console.log('没有注入记录'); return; }
    for (const rel of fs.readFileSync(PATCHED_LIST, 'utf8').split('\n').filter(Boolean)) {
      const abs = path.join(BASE_DIR, rel);
      try { fs.rmSync(abs, { force: true }); console.log(`[回滚] ${rel}`); } catch (e) { console.warn(e.message); }
    }
    fs.rmSync(PATCHED_LIST, { force: true });
    return;
  }

  const assets = copyAssets(dry);
  const touched = applyAnchoredPatches(dry);
  if (!dry) {
    fs.mkdirSync(path.dirname(PATCHED_LIST), { recursive: true });
    fs.writeFileSync(PATCHED_LIST, touched.join('\n'), 'utf8');
  }
  console.log(`\n完成：资源 ${assets.length} 个，代码注入 ${touched.length} 处`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}