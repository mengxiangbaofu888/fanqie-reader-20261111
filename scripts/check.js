#!/usr/bin/env node
/**
 * 仓库自检：不碰 Java，纯 JS 跑完，CI 的 lint 关和本地提交前都能用。
 *
 * 检查项：
 *   1. VERSION 格式合法
 *   2. CHANGELOG 有对应版本小节
 *   3. data/ 三个数据文件能解析、条数达标（书源 ≥ 130，排版预设 ≥ 13）
 *   4. 工作流 YAML 里没有硬编码密钥
 *   5. 脚本语法完整（用 node --check 逐个过）
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.error(`  ✗ ${m}`); failed++; };

function checkVersion() {
  console.log('\n[1] 版本号');
  const v = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(v)) return bad(`VERSION 格式不对: ${v}`);
  ok(`VERSION = ${v}`);

  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  if (!cl.includes(`## [${v}]`)) return bad(`CHANGELOG.md 没有 [${v}] 小节`);
  ok('CHANGELOG 有对应小节');
}

function checkData() {
  console.log('\n[2] 内置数据');
  const specs = [
    { f: 'bookSources-builtin.json', min: 130, unit: '书源' },
    { f: 'kuangye-bookSources-133.json', min: 130, unit: '旷野书源' },
    { f: 'readConfig-merged-13-dark.json', min: 13, unit: '排版预设' },
  ];
  for (const s of specs) {
    const p = path.join(ROOT, 'data', s.f);
    if (!fs.existsSync(p)) { bad(`${s.f} 不存在`); continue; }
    try {
      const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!Array.isArray(arr)) { bad(`${s.f} 不是数组`); continue; }
      if (arr.length < s.min) bad(`${s.f} 只有 ${arr.length} 条${s.unit}，应 ≥ ${s.min}`);
      else ok(`${s.f}: ${arr.length} 条${s.unit}`);
    } catch (e) {
      bad(`${s.f} 解析失败: ${e.message}`);
    }
  }
}

function checkSecrets() {
  console.log('\n[3] 工作流不含硬编码密钥');
  const wfDir = path.join(ROOT, '.github', 'workflows');
  if (!fs.existsSync(wfDir)) return ok('没有工作流目录');
  const patterns = [
    /gho_[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /sk-[A-Za-z0-9]{20,}/,
  ];
  for (const f of fs.readdirSync(wfDir)) {
    const text = fs.readFileSync(path.join(wfDir, f), 'utf8');
    const hit = patterns.find((re) => re.test(text));
    if (hit) bad(`${f} 里疑似硬编码密钥: ${hit}`);
    else ok(`${f} 干净`);
  }
}

function checkSyntax() {
  console.log('\n[4] 脚本语法');
  const dir = path.join(ROOT, 'scripts');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    try {
      execFileSync(process.execPath, ['--check', path.join(dir, f)], { stdio: 'pipe' });
      ok(f);
    } catch (e) {
      bad(`${f}: ${e.stderr?.toString() || e.message}`);
    }
  }
}

console.log('仓库自检');
checkVersion();
checkData();
checkSecrets();
checkSyntax();

console.log(failed ? `\n失败 ${failed} 项` : '\n全部通过');
process.exit(failed ? 1 : 0);