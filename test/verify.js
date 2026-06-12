'use strict';
/**
 * 驗證測試：以開源庫 iztro 為對照組（僅開發期使用），
 * 隨機產生大量命例，逐宮逐項比對本引擎輸出，確保轉寫邏輯正確。
 *
 * 執行：node test/verify.js [命例數]
 */
const { astro } = require('iztro');
const { 排盤, 排運限 } = require('../src');

const 命例數 = Number(process.argv[2] || 300);
const 統計 = {};
const 錯誤樣本 = [];
let 通過 = 0;

function 記錄(欄位, 訊息) {
  統計[欄位] = (統計[欄位] || 0) + 1;
  if (錯誤樣本.length < 40) 錯誤樣本.push(`[${欄位}] ${訊息}`);
}

function 隨機整數(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function 隨機日期() {
  const 年 = 隨機整數(1920, 2050);
  const 月 = 隨機整數(1, 12);
  const 日 = 隨機整數(1, [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][月 - 1]);
  return { 年, 月, 日 };
}

function 集合相等(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join('|');
  const sb = [...b].sort().join('|');
  return sa === sb;
}

function 比對命例(編號) {
  const 生 = 隨機日期();
  const 時辰 = 隨機整數(0, 12);
  const 性別 = Math.random() < 0.5 ? '男' : '女';
  const 標籤 = `${生.年}-${生.月}-${生.日} t${時辰} ${性別}`;
  let 失敗 = false;
  const 檢查 = (欄位, mine, theirs) => {
    const m = JSON.stringify(mine);
    const t = JSON.stringify(theirs);
    if (m !== t) { 記錄(欄位, `${標籤}: 本引擎=${m} iztro=${t}`); 失敗 = true; }
  };

  let a, mine;
  try {
    a = astro.bySolar(`${生.年}-${生.月}-${生.日}`, 時辰, 性別 === '男' ? 'male' : 'female', true, 'zh-TW');
    mine = 排盤({ 曆別: 'solar', ...生, 時辰, 性別 });
  } catch (e) {
    記錄('exception', `${標籤}: ${e.message}`);
    return false;
  }

  // iztro 以「冬月、腊月、闰」表記，正規化後比對
  const 正規化農曆 = String(a.lunarDate).replace('冬月', '十一月').replace('腊月', '十二月').replace('闰', '閏');
  檢查('農曆', mine.農曆, 正規化農曆);
  檢查('四柱', mine.四柱, a.chineseDate);
  檢查('命主', mine.命主, a.soul);
  檢查('身主', mine.身主, a.body);
  檢查('五行局', mine.五行局, a.fiveElementsClass);
  檢查('命宮地支', mine.命宮地支, a.earthlyBranchOfSoulPalace);
  檢查('身宮地支', mine.身宮地支, a.earthlyBranchOfBodyPalace);

  for (let i = 0; i < 12; i++) {
    const p = a.palaces[i];
    const q = mine.宮位[i];
    檢查(`宮名`, q.宮名, p.name);
    檢查(`宮干`, q.天干, p.heavenlyStem);
    檢查(`宮支`, q.地支, p.earthlyBranch);
    檢查(`身宮旗標`, q.是身宮, p.isBodyPalace);
    檢查(`來因宮旗標`, q.是來因宮, p.isOriginalPalace);
    檢查(`主星`, q.主星.map((s) => s.名稱 + s.亮度 + s.四化).sort(),
      p.majorStars.map((s) => s.name + (s.brightness || '') + (s.mutagen || '')).sort());
    檢查(`輔星`, q.輔星.map((s) => s.名稱 + s.亮度 + s.四化).sort(),
      p.minorStars.map((s) => s.name + (s.brightness || '') + (s.mutagen || '')).sort());
    if (!集合相等(q.雜曜.map((s) => s.名稱), p.adjectiveStars.map((s) => s.name))) {
      記錄('雜曜', `${標籤} 宮${i}: 本引擎=${q.雜曜.map((s) => s.名稱)} iztro=${p.adjectiveStars.map((s) => s.name)}`);
      失敗 = true;
    }
    檢查(`長生12`, q.長生十二神, p.changsheng12);
    檢查(`博士12`, q.博士十二神, p.boshi12);
    檢查(`將前12`, q.將前十二神, p.jiangqian12);
    檢查(`歲前12`, q.歲前十二神, p.suiqian12);
    檢查(`大限範圍`, [q.大限.起, q.大限.迄], p.decadal.range);
    檢查(`小限歲數`, q.小限歲數, p.ages.slice(0, 10));
  }

  // 運限比對：取生年之後的隨機目標日
  const 目標 = { 年: 隨機整數(生.年 + 1, 2055), 月: 隨機整數(1, 12), 日: 隨機整數(1, 28), 時辰: 隨機整數(0, 11) };
  let h, mh;
  try {
    const 原始 = a.horoscope(`${目標.年}-${目標.月}-${目標.日} ${String(目標.時辰 === 0 ? 0 : 目標.時辰 * 2 - 1).padStart(2, '0')}:30`);
    h = JSON.parse(JSON.stringify({
      decadal: 原始.decadal, age: 原始.age, yearly: 原始.yearly,
      monthly: 原始.monthly, daily: 原始.daily, hourly: 原始.hourly,
    }));
    mh = 排運限(mine, 目標);
  } catch (e) {
    記錄('horoscope-exception', `${標籤} → ${目標.年}-${目標.月}-${目標.日}: ${e.message}`);
    return false;
  }

  const 目標籤 = `→${目標.年}-${目標.月}-${目標.日} t${目標.時辰}`;
  const 流曜名 = (層) => 層.flat().map((s) => (typeof s === 'string' ? s : s.name)).sort();
  const 層比對 = (鍵, mineL, theirsL, 含流曜 = true) => {
    檢查(`${鍵}.宮位 ${目標籤}`, mineL.宮位索引, theirsL.index);
    檢查(`${鍵}.干`, mineL.天干, theirsL.heavenlyStem);
    檢查(`${鍵}.支`, mineL.地支, theirsL.earthlyBranch);
    檢查(`${鍵}.宮名`, mineL.宮名, theirsL.palaceNames);
    檢查(`${鍵}.四化`, Object.values(mineL.四化), theirsL.mutagen);
    if (含流曜 && theirsL.stars) {
      for (let i = 0; i < 12; i++) {
        檢查(`${鍵}.流曜`, 流曜名([mineL.流曜[i]]), 流曜名([theirsL.stars[i]]));
      }
    }
  };
  // iztro 於童限（虛歲未達起運歲數）時 decadal.index 回傳 -1，本引擎以命宮為童限，略過比對
  if (h.decadal.index >= 0) 層比對('大限', mh.大限, h.decadal);
  // iztro 小限超過 120 歲回傳 -1，略過比對
  if (h.age.index >= 0) {
    層比對('小限', { ...mh.小限, 流曜: null }, h.age, false);
    檢查('小限.虛歲', mh.小限.虛歲, h.age.nominalAge);
  }
  層比對('流年', mh.流年, h.yearly);
  檢查('流年.將前12', mh.流年.將前十二神, h.yearly.yearlyDecStar.jiangqian12);
  檢查('流年.歲前12', mh.流年.歲前十二神, h.yearly.yearlyDecStar.suiqian12);
  層比對('流月', mh.流月, h.monthly);
  層比對('流日', mh.流日, h.daily);
  層比對('流時', mh.流時, h.hourly);

  return !失敗;
}

for (let i = 0; i < 命例數; i++) {
  if (比對命例(i)) 通過 += 1;
}

console.log(`\n=== 驗證結果：${通過}/${命例數} 命例完全一致 ===`);
if (Object.keys(統計).length) {
  console.log('\n不一致欄位統計：');
  for (const [k, v] of Object.entries(統計).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  console.log('\n樣本（最多 40 筆）：');
  錯誤樣本.forEach((s) => console.log('  ' + s));
  process.exitCode = 1;
}
