#!/usr/bin/env node
/**
 * 本地一键构建（等价于 CI 的 build job，但跑在 Windows）。
 *
 * 前置：
 *   - JDK 17（本机已有 D:\github\downloads\tomato-apk-re-20261108\tools\jdk-17.0.20.1+1）
 *   - Android SDK（本机已有 build-tools 36 + platform）
 *
 * 用法：
 *   node scripts/build-local.js --abi arm64
 *   node scripts/build-local.js --abi universal --skip-base
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'build', 'base', 'legado');

// 本机现成环境：JDK 17 在 downloads 的逆向工具目录，SDK 在 electro-tutor 的本地工具目录
const DEFAULT_JDK = 'D:\\github\\downloads\\tomato-apk-re-20261108\\tools\\jdk-17.0.20.1+1';
const DEFAULT_SDK = 'D:\\github\\projects\\electro-tutor-20261005\\.android-tools\\android-sdk';

function run(cmd, args, cwd, env) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

function main() {
  const abiIdx = process.argv.indexOf('--abi');
  const abi = abiIdx >= 0 ? process.argv[abiIdx + 1] : 'arm64';
  const skipBase = process.argv.includes('--skip-base');

  const jdk = process.env.JAVA_HOME || DEFAULT_JDK;
  const sdk = process.env.ANDROID_HOME || DEFAULT_SDK;
  if (!fs.existsSync(jdk)) throw new Error(`JDK 不存在: ${jdk}`);
  if (!fs.existsSync(sdk)) throw new Error(`Android SDK 不存在: ${sdk}（需要 platforms;android-34 + build-tools）`);

  const env = {
    JAVA_HOME: jdk,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
  };

  const node = process.execPath;
  if (!skipBase) run(node, [path.join(__dirname, 'prepare-base.js')], ROOT);
  run(node, [path.join(__dirname, 'apply-patches.js')], ROOT);

  const gradlew = path.join(BASE_DIR, process.platform === 'win32' ? 'gradlew.bat' : './gradlew');
  run(
    gradlew,
    ['assembleAppRelease', '--no-daemon', `-PabiFilter=${abi}`],
    BASE_DIR,
    env
  );

  const { readVersion } = require('./bump-version.js');
  const v = readVersion();
  run(node, [path.join(__dirname, 'collect-apk.js'), '--suffix', abi, '--version', v.text], ROOT);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('\n失败: ' + e.message); process.exit(1); }
}