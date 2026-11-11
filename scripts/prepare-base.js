#!/usr/bin/env node
/**
 * 拉取并锁定底座源码。
 *
 * 底座：阅读 Legado（GPL-3.0，https://github.com/gedoor/legado）
 * 本仓库不 vendored 上游源码，而是在构建时浅克隆到 build/base/legado，
 * 因为上游仓库体积大（含历史资源），且需要保持上游许可与来源可追溯。
 *
 * 用法：
 *   node scripts/prepare-base.js                 # 用 BASE_REF 里的锁定版本
 *   node scripts/prepare-base.js --ref <commit>  # 临时指定
 *   node scripts/prepare-base.js --force         # 删掉重拉
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'build', 'base', 'legado');
const LOCK_FILE = path.join(ROOT, 'gradle', 'base-source.json');

// 上游地址。GitHub 直连不通时用镜像，可用环境变量覆盖。
const MIRRORS = [
  process.env.LEGADO_MIRROR,
  'https://github.com/gedoor/legado.git',
  'https://gitee.com/mirrors_gedoor/legado.git',
  'https://hub.fastgit.xyz/gedoor/legado.git',
].filter(Boolean);

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    stdio: opts.quiet ? 'pipe' : 'inherit',
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readLock() {
  if (!fs.existsSync(LOCK_FILE)) {
    return { repo: MIRRORS[1], ref: 'HEAD', baseVersion: '3.26.23' };
  }
  return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const refIdx = args.indexOf('--ref');
  const lock = readLock();
  const ref = refIdx >= 0 ? args[refIdx + 1] : lock.ref;

  if (force && fs.existsSync(BASE_DIR)) fs.rmSync(BASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(BASE_DIR), { recursive: true });

  if (!fs.existsSync(path.join(BASE_DIR, '.git'))) {
    let cloned = false;
    let lastErr = null;
    for (const url of [lock.repo, ...MIRRORS]) {
      try {
        console.log(`[拉源码] ${url}`);
        sh('git', ['clone', '--depth', '1', '--branch', ref, url, BASE_DIR]);
        cloned = true;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[失败] ${url}: ${e.message.split('\n')[0]}`);
        fs.rmSync(BASE_DIR, { recursive: true, force: true });
      }
    }
    if (!cloned) throw lastErr || new Error('所有镜像都失败');
  } else {
    console.log('[源码已存在，跳过克隆]');
  }

  const head = sh('git', ['rev-parse', 'HEAD'], { cwd: BASE_DIR, quiet: true }).trim();
  const desc = sh('git', ['describe', '--tags', '--always'], { cwd: BASE_DIR, quiet: true }).trim();
  console.log(`[底座] ref=${ref} commit=${head} describe=${desc}`);

  fs.writeFileSync(
    path.join(ROOT, 'build', 'base', 'source-lock.json'),
    JSON.stringify({ repo: lock.repo, ref, commit: head, describe: desc, fetchedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}