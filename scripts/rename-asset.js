#!/usr/bin/env node
/**
 * 附件改名：把子串替换掉。
 * 用法: node scripts/rename-asset.js --suffix arm64 --version 4.1.0
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
function arg(n, d) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; }

const suffix = arg('suffix', 'universal');
const version = arg('version', '0.0.0');
const label = arg('label', '番茄排版');

const src = fs.readdirSync(DIST).filter((f) => f.endsWith('.apk'));
if (!src.length) { console.error('dist 里没有 apk'); process.exit(1); }
const from = path.join(DIST, src[0]);
const to = path.join(DIST, `阅读-${label}-${suffix}-${version}.apk`);
if (from !== to) fs.renameSync(from, to);
console.log(`${src[0]} -> ${path.basename(to)}`);