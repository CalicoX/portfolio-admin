#!/usr/bin/env node

/**
 * 在提交代码后自动更新 memory.md 的提交历史部分
 * 用法: node scripts/update-memory.js [commit-hash] [commit-message]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const MEMORY_PATH = resolve(process.cwd(), 'memory/MEMORY.md');

function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const message = execSync('git log -1 --pretty=%B').toString().trim();
    const date = execSync('git log -1 --format=%cd --date=short').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    return { hash, message: message.split('\n')[0], date, branch };
  } catch (e) {
    return null;
  }
}

function updateMemory() {
  const info = getGitInfo();
  if (!info) {
    console.log('❌ 无法获取 git 信息');
    process.exit(1);
  }

  try {
    let content = readFileSync(MEMORY_PATH, 'utf-8');

    // 检查是否已有提交历史部分
    const historyMarker = '## 最近提交历史';
    const entry = `- **${info.date}** \`${info.hash}\` (${info.branch}): ${info.message}`;

    if (content.includes(historyMarker)) {
      // 在标记后添加新条目
      content = content.replace(
        new RegExp(`(${historyMarker}\\n\\n)`),
        `$1${entry}\n`
      );
    } else {
      // 在文件末尾添加新部分
      content += `\n\n${historyMarker}\n\n${entry}\n`;
    }

    writeFileSync(MEMORY_PATH, content, 'utf-8');
    console.log('✅ 已更新 memory/MEMORY.md');
    console.log(`   ${entry}`);

    // 自动添加修改后的 memory 文件
    try {
      execSync('git add memory/MEMORY.md');
      console.log('✅ 已暂存 memory/MEMORY.md');
    } catch (e) {
      // 忽略错误
    }
  } catch (e) {
    console.error('❌ 更新 memory 失败:', e.message);
    process.exit(1);
  }
}

updateMemory();
