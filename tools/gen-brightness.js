/**
 * 開發期工具：由 extracted.json 產生 src/brightness.js（星曜廟旺利陷亮度表）。
 * 亮度表為傳統紫微斗數固定資料表（星曜 × 十二地支宮位）。
 */
const fs = require('fs');
const d = require('./extracted.json');
const 地支 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 只保留有亮度的星曜（十四主星 + 文昌文曲擎羊陀羅火星鈴星）
const rows = [];
for (const [star, m] of Object.entries(d.brightness)) {
  const vals = 地支.map((b) => m[b] || '');
  if (vals.every((v) => v === '')) continue;
  // 擎羊、陀羅受祿存位置限制，先天僅出現於 8 個地支，其餘宮位留空
  rows.push(`  ${JSON.stringify(star)}: [${vals.map((v) => `'${v}'`).join(', ')}],`);
}

const out = `'use strict';
/**
 * 星曜亮度表（廟、旺、得、利、平、不、陷）
 * 傳統固定資料表：每顆星曜在十二地支宮位之亮度，索引順序為
 * 子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥。
 */
const 亮度表 = {
${rows.join('\n')}
};

/** 取得星曜於某地支宮位的亮度，無資料則回傳空字串 */
function 取亮度(星名, 地支索引) {
  const row = 亮度表[星名];
  return row ? row[地支索引] : '';
}

module.exports = { 亮度表, 取亮度 };
`;
fs.writeFileSync(__dirname + '/../src/brightness.js', out, 'utf8');
console.log('已產生 src/brightness.js，共', rows.length, '顆星曜');
