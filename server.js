'use strict';
/**
 * 紫微斗數排盤 API 伺服器
 *
 * 端點：
 *   GET  /api/v1/natal      本命盤（query 參數）
 *   POST /api/v1/natal      本命盤（JSON body）
 *   GET  /api/v1/horoscope  本命盤＋運限（大限/小限/流年/流月/流日/流時）
 *   POST /api/v1/horoscope  同上（JSON body）
 *   GET  /api/v1/doc        機器可讀 API 說明（供 LLM 工具描述使用）
 *   GET  /api/v1/health     健康檢查
 *
 * 參數（GET 與 POST 同名）：
 *   calendar  'solar'（國曆，預設）或 'lunar'（農曆）
 *   year, month, day        出生年月日（依 calendar 解讀）
 *   isLeapMonth             是否閏月（僅農曆輸入，預設 false）
 *   timeIndex               時辰 0–12（0=早子 1=丑 … 11=亥 12=晚子）；或改用 hour 0–23
 *   gender                  'male'/'female' 或 '男'/'女'
 *   targetDate              運限目標日 YYYY-MM-DD（horoscope 端點，預設今日）
 *   targetTimeIndex         運限目標時辰 0–12；或 targetHour 0–23（預設 0）
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { 排盤, 排運限, 文字盤, 清理, 曆 } = require('./src');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** 解析共用參數成排盤輸入 */
function 解析參數(p) {
  const 性別原 = String(p.gender || '').toLowerCase();
  const 性別 = 性別原 === 'male' || 性別原 === '男' ? '男'
    : 性別原 === 'female' || 性別原 === '女' ? '女' : null;
  if (!性別) throw new RangeError("gender 須為 'male'/'female' 或 '男'/'女'");

  let 時辰;
  if (p.timeIndex !== undefined && p.timeIndex !== '') 時辰 = Number(p.timeIndex);
  else if (p.hour !== undefined && p.hour !== '') 時辰 = 曆.鐘點轉時辰(Number(p.hour));
  else throw new RangeError('須提供 timeIndex（0–12）或 hour（0–23）');

  const 年 = Number(p.year), 月 = Number(p.month), 日 = Number(p.day);
  if (!Number.isInteger(年) || !Number.isInteger(月) || !Number.isInteger(日)) {
    throw new RangeError('year/month/day 須為整數');
  }
  return {
    曆別: p.calendar === 'lunar' ? 'lunar' : 'solar',
    年, 月, 日,
    閏月: p.isLeapMonth === true || p.isLeapMonth === 'true' || p.isLeapMonth === '1',
    時辰, 性別,
  };
}

function 解析目標(p) {
  let 目標年, 目標月, 目標日;
  if (p.targetDate) {
    const m = String(p.targetDate).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) throw new RangeError('targetDate 格式須為 YYYY-MM-DD');
    [目標年, 目標月, 目標日] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    const now = new Date();
    [目標年, 目標月, 目標日] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  }
  let 時辰 = 0;
  if (p.targetTimeIndex !== undefined && p.targetTimeIndex !== '') 時辰 = Number(p.targetTimeIndex);
  else if (p.targetHour !== undefined && p.targetHour !== '') 時辰 = 曆.鐘點轉時辰(Number(p.targetHour));
  return { 年: 目標年, 月: 目標月, 日: 目標日, 時辰 };
}

function 處理(handler) {
  return (req, res) => {
    try {
      const p = req.method === 'GET' ? req.query : req.body || {};
      res.json({ success: true, data: handler(p) });
    } catch (e) {
      res.status(e instanceof RangeError ? 400 : 500).json({ success: false, error: e.message });
    }
  };
}

const natalHandler = 處理((p) => 清理(排盤(解析參數(p))));
const horoscopeHandler = 處理((p) => {
  const 本命 = 排盤(解析參數(p));
  const 運限 = 排運限(本命, 解析目標(p));
  return { 本命: 清理(本命), 運限 };
});

// 純文字命盤（樹狀格式，適合直接放入 LLM 對話）
function textHandler(req, res) {
  try {
    const p = req.method === 'GET' ? req.query : req.body || {};
    const 本命 = 排盤(解析參數(p));
    // 未明確給 targetDate 時仍以今日計算運限疊宮；傳 targetDate=none 可省略運限
    const 含運限 = String(p.targetDate).toLowerCase() !== 'none';
    const 運限 = 含運限 ? 排運限(本命, 解析目標(p)) : null;
    res.type('text/plain; charset=utf-8').send(文字盤(本命, 運限));
  } catch (e) {
    res.status(e instanceof RangeError ? 400 : 500).type('text/plain; charset=utf-8').send('錯誤：' + e.message);
  }
}

app.get('/api/v1/natal', natalHandler);
app.post('/api/v1/natal', natalHandler);
app.get('/api/v1/horoscope', horoscopeHandler);
app.post('/api/v1/horoscope', horoscopeHandler);
app.get('/api/v1/text', textHandler);
app.post('/api/v1/text', textHandler);
app.get('/api/v1/health', (req, res) => res.json({ success: true, data: 'ok' }));
app.get('/api/v1/doc', (req, res) => {
  // baseUrl 依實際請求來源動態產生（本機或雲端皆正確）
  const doc = require('./public/api-doc.json');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  res.json({ ...doc, baseUrl: `${proto}://${req.get('host')}` });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`紫微斗數排盤服務已啟動： http://localhost:${PORT}`);
    console.log(`API 文件： http://localhost:${PORT}/api/v1/doc`);
  });
}

module.exports = app;
