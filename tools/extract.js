/**
 * 開發期工具：以 iztro 為對照組，萃取傳統安星表資料（亮度表、雜曜對應表）。
 * 此檔僅供開發驗證使用，正式排盤引擎（src/）不依賴 iztro。
 */
const { astro } = require('iztro');
const fs = require('fs');

const 地支 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 取得某張盤上「星名 → 宮位索引（寅=0）」的對應，以及亮度
function chartStars(a) {
  const pos = {};
  const bright = {};
  a.palaces.forEach((p, i) => {
    [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].forEach((s) => {
      pos[s.name] = i;
      if (s.brightness) bright[s.name + '@' + i] = s.brightness;
    });
  });
  return { pos, bright, soul: a.soul, body: a.body, five: a.fiveElementsClass };
}

const out = {};

// 1) 變動農曆「年支」（連續 12 年），固定 七月十七 寅時 女
out.byYearBranch = {};
for (let y = 2008; y <= 2019; y++) {
  const a = astro.byLunar(`${y}-7-17`, 2, 'female', false, true, 'zh-TW');
  out.byYearBranch[`${y}(${地支[(y - 4) % 12]})`] = chartStars(a);
}

// 2) 變動農曆「年干」（連續 10 年）
out.byYearStem = {};
for (let y = 2010; y <= 2019; y++) {
  const a = astro.byLunar(`${y}-7-17`, 2, 'female', false, true, 'zh-TW');
  out.byYearStem[y] = chartStars(a);
}

// 3) 變動農曆「月」（1~12 月），固定 2000 年 十七日 寅時
out.byMonth = {};
for (let m = 1; m <= 12; m++) {
  const a = astro.byLunar(`2000-${m}-17`, 2, 'female', false, true, 'zh-TW');
  out.byMonth[m] = chartStars(a);
}

// 4) 變動農曆「日」（1~29 日）
out.byDay = {};
for (let d = 1; d <= 29; d++) {
  const a = astro.byLunar(`2000-7-${d}`, 2, 'female', false, true, 'zh-TW');
  out.byDay[d] = chartStars(a);
}

// 5) 變動「時辰」（0~12，含晚子時）
out.byHour = {};
for (let h = 0; h <= 12; h++) {
  const a = astro.byLunar('2000-7-17', h, 'female', false, true, 'zh-TW');
  out.byHour[h] = chartStars(a);
}

// 6) 亮度表蒐集：大量隨機命例，收集 星名 × 地支宮位 → 亮度
const brightTable = {};
let cnt = 0;
for (let y = 1950; y <= 2010; y += 1) {
  for (const md of [[1, 5], [3, 11], [5, 17], [7, 23], [9, 28], [11, 9]]) {
    for (const h of [0, 3, 6, 9]) {
      try {
        const a = astro.byLunar(`${y}-${md[0]}-${md[1]}`, h, 'male', false, true, 'zh-TW');
        a.palaces.forEach((p, i) => {
          const branch = 地支[(i + 2) % 12];
          [...p.majorStars, ...p.minorStars].forEach((s) => {
            if (s.brightness !== undefined && s.brightness !== '') {
              brightTable[s.name] = brightTable[s.name] || {};
              brightTable[s.name][branch] = s.brightness;
            } else if (s.brightness === '') {
              brightTable[s.name] = brightTable[s.name] || {};
              if (!(branch in brightTable[s.name])) brightTable[s.name][branch] = '';
            }
          });
        });
        cnt++;
      } catch (e) { /* 略過無效農曆日期 */ }
    }
  }
}
out.brightness = brightTable;
out.brightnessSampleCount = cnt;

fs.writeFileSync(__dirname + '/extracted.json', JSON.stringify(out, null, 1), 'utf8');
console.log('完成，樣本數:', cnt);
