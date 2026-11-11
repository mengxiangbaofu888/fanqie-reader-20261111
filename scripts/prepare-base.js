#!/usr/bin/env node
/**
 * 拉取并锁定底座源码。
 *
 * 背景（2026-11-11 实测）：
 *   上游 gedoor/legado 已于 2026-05-27 清空为公告仓库，源码与 tag 全部下架。
 *   本仓库改用保留完整历史的镜像 HapeLee/legado-with-MD3，其 3.26.23 与上游发布版同源。
 *
 * 两条通道，按顺序尝试：
 *   1. git 浅克隆（CI 首选，秒级）
 *   2. codeload tarball 下载（git 通道被网络掐断时的退路，实测 GitHub 侧限速约 30KB/s）
 *
 * 用法：
 *   node scripts/prepare-base.js                 # 用 gradle/base-source.json 里锁定的 ref
 *   node scripts/prepare-base.js --ref <tag>     # 临时指定
 *   node scripts/prepare-base.js --tarball       # 强制走 tarball 通道
 *   node scripts/prepare-base.js --force         # 清掉重拉
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'build', 'base', 'legado');
const LOCK_FILE = path.join(ROOT, 'gradle', 'base-source.json');

function readLock() {
  if (!fs.existsSync(LOCK_FILE)) {
    return { repo: 'https://github.com/HapeLee/legado-with-MD3.git', ref: '3.26.23' };
  }
  return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
}

function mirrorList(lock) {
  return [
    process.env.LEGADO_MIRROR,
    lock.repo,
    'https://github.com/HapeLee/legado-with-MD3.git',
    'https://gitee.com/mirrors_gedoor/legado.git',
  ].filter((v, i, a) => v && a.indexOf(v) === i);
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    stdio: opts.quiet ? 'pipe' : 'inherit',
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** 通道 1：git 浅克隆 */
function viaGit(lock, ref) {
  for (const url of mirrorList(lock)) {
    try {
      console.log(`[git] ${url} @ ${ref}`);
      sh('git', ['clone', '--depth', '1', '--branch', ref, url, BASE_DIR]);
      return { channel: 'git', repo: url, commit: headOf(BASE_DIR), describe: ref };
    } catch (e) {
      console.warn(`[git 失败] ${url}: ${String(e.message).split('\n')[0]}`);
      fs.rmSync(BASE_DIR, { recursive: true, force: true });
    }
  }
  return null;
}

function headOf(dir) {
  try {
    return sh('git', ['rev-parse', 'HEAD'], { cwd: dir, quiet: true }).trim();
  } catch {
    return null;
  }
}

/** 通道 2：codeload tarball */
function viaTarball(lock, ref) {
  const ownerRepo = lock.repo
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '');
  const url = `https://codeload.github.com/${ownerRepo}/tar.gz/refs/tags/${ref}`;
  const tmp = path.join(ROOT, 'build', 'base', `${ref}.tar.gz`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });

  console.log(`[tarball] ${url}`);
  sh('curl', [
    '-s', '-L', '--max-time', '3600',
    '--speed-time', '180', '--speed-limit', '256',
    '-o', tmp, url,
  ], { quiet: false });

  const size = fs.statSync(tmp).size;
  if (size < 1024 * 1024) throw new Error(`tarball 太小（${size} 字节），下载不完整`);

  fs.rmSync(BASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(BASE_DIR, { recursive: true });
  // --strip-components=1 去掉顶层目录名
  sh('tar', ['-xzf', tmp, '-C', BASE_DIR, '--strip-components=1']);
  return { channel: 'tarball', repo: lock.repo, commit: null, describe: ref };
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const refIdx = args.indexOf('--ref');
  const lock = readLock();
  const ref = refIdx >= 0 ? args[refIdx + 1] : lock.ref;

  if (force && fs.existsSync(BASE_DIR)) fs.rmSync(BASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(ROOT, 'build', 'base'), { recursive: true });

  if (fs.existsSync(path.join(BASE_DIR, 'settings.gradle')) ||
      fs.existsSync(path.join(BASE_DIR, 'settings.gradle.kts'))) {
    console.log('[底座已就绪，跳过]');
  } else {
    let result = null;
    if (!args.includes('--tarball')) result = viaGit(lock, ref);
    if (!result) result = viaTarball(lock, ref);
    fs.writeFileSync(
      path.join(ROOT, 'build', 'base', 'source-lock.json'),
      JSON.stringify({ ...result, ref, fetchedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
    console.log(`[底座] ${result.channel} commit=${result.commit || '-'} ref=${ref}`);
  }

  // 落地 sdk.dir，Gradle 需要
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    fs.writeFileSync(
      path.join(BASE_DIR, 'local.properties'),
      `sdk.dir=${sdk.replace(/\\/g, '/')}\n`,
      'utf8'
    );
    console.log(`[SDK] local.properties -> ${sdk}`);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('失败: ' + e.message); process.exit(1); }
}