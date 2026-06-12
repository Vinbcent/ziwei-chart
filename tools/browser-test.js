'use strict';
/**
 * 開發期工具：無頭瀏覽器（Edge）端對端測試網頁排盤介面。
 * 驗證：console/網路錯誤、十二宮渲染、中央資訊、自化標記、疊盤切換、三方四正、文字盤分頁，並截圖。
 * 用法：node tools/browser-test.js [網址]
 */
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || 'http://localhost:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const 問題 = [];

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });
    page.on('console', (m) => { if (m.type() === 'error') 問題.push(`[console.error] ${m.text()}`); });
    page.on('pageerror', (e) => 問題.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', (r) => 問題.push(`[request失敗] ${r.url()} ${r.failure().errorText}`));
    page.on('response', (r) => { if (r.status() >= 400) 問題.push(`[HTTP ${r.status()}] ${r.url()}`); });

    console.log('1) 載入 ' + BASE);
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('2) 填表單、排盤');
    await page.evaluate(() => {
      document.getElementById('year').value = '2000';
      document.getElementById('month').value = '8';
      document.getElementById('day').value = '16';
      document.getElementById('targetDate').value = '2026-06-12';
    });
    await page.select('#timeIndex', '2');
    await page.select('#targetTimeIndex', '5');
    await page.click('label[for=g-f]');
    await page.click('#go');
    try {
      await page.waitForSelector('#grid .palace', { visible: true, timeout: 30000 });
    } catch {
      const err = await page.$eval('#error', (el) => el.textContent).catch(() => '');
      問題.push('宮位未渲染。頁面錯誤訊息：' + (err || '(無)'));
      throw new Error('render-failed');
    }

    const 宮數 = await page.$$eval('#grid .palace', (els) => els.length);
    console.log(`   宮位數 ${宮數} ${宮數 === 12 ? '✓' : '✗'}`);
    if (宮數 !== 12) 問題.push('宮位數量錯誤: ' + 宮數);

    const 中央 = await page.$eval('#center', (el) => el.innerText);
    for (const k of ['庚辰 甲申 丙午 庚寅', '木三局', '破軍', '文昌', '丙午', '虛歲 27']) {
      const ok = 中央.includes(k);
      console.log(`   中央含「${k}」 ${ok ? '✓' : '✗'}`);
      if (!ok) 問題.push('中央資訊缺少: ' + k);
    }

    const 命宮卡 = await page.$$eval('#grid .palace', (els) => {
      const t = els.find((e) => e.querySelector('.pname') && e.querySelector('.pname').textContent.startsWith('命宮'));
      return t ? t.innerText : '';
    });
    const ok命 = 命宮卡.includes('紫微') && 命宮卡.includes('壬午');
    console.log('   命宮壬午坐紫微 ' + (ok命 ? '✓' : '✗'));
    if (!ok命) 問題.push('命宮渲染異常: ' + 命宮卡.slice(0, 60));

    const 有自化 = await page.$$eval('.chip.self', (els) => els.length);
    console.log(`   自化標記 ${有自化} 處 ${有自化 > 0 ? '✓' : '✗'}`);
    if (!有自化) 問題.push('未渲染任何自化標記');

    console.log('3) 切換流月/流日/流時疊盤');
    for (const k of ['月', '日', '時']) await page.click(`#layer-pills .pill[data-k="${k}"]`);
    await new Promise((r) => setTimeout(r, 600));
    const 有時曜 = await page.$$eval('#grid .flow span', (els) => els.some((e) => /^時/.test(e.textContent)));
    console.log('   流時流曜顯示 ' + (有時曜 ? '✓' : '✗'));
    if (!有時曜) 問題.push('切換後未顯示流時流曜');

    console.log('4) 三方四正');
    await page.click('#grid .palace[data-idx="4"]');
    const sel = await page.$$eval('#grid .palace.selected', (e) => e.length);
    const tri = await page.$$eval('#grid .palace.tri', (e) => e.length);
    console.log(`   selected=${sel}/1 tri=${tri}/3 ${sel === 1 && tri === 3 ? '✓' : '✗'}`);
    if (!(sel === 1 && tri === 3)) 問題.push('三方四正標示異常');
    const 線 = await page.$eval('#lines', (el) => ({ poly: el.querySelectorAll('polygon').length, line: el.querySelectorAll('line').length, dot: el.querySelectorAll('circle').length }));
    console.log(`   指示線 三角形=${線.poly}/1 對宮線=${線.line}/1 端點=${線.dot}/4 ${線.poly === 1 && 線.line === 1 && 線.dot === 4 ? '✓' : '✗'}`);
    if (!(線.poly === 1 && 線.line === 1 && 線.dot === 4)) 問題.push('三方四正指示線異常');
    await page.click('#grid .palace[data-idx="4"]'); // 取消選取應清線
    const 清 = await page.$eval('#lines', (el) => el.childNodes.length);
    console.log(`   取消選取清線 ${清 === 0 ? '✓' : '✗'}`);
    if (清 !== 0) 問題.push('取消選取未清除指示線');
    await page.click('#grid .palace[data-idx="4"]'); // 重新選取供截圖


    console.log('5) 文字盤分頁');
    await page.click('.tab[data-view="text"]');
    const 文字 = await page.$eval('#text-pane', (el) => el.textContent);
    const ok文 = 文字.includes('紫微斗數命盤') && 文字.includes('命盤十二宮') && 文字.includes('十二大限流年');
    console.log('   文字盤內容 ' + (ok文 ? '✓' : '✗'));
    if (!ok文) 問題.push('文字盤內容異常: ' + 文字.slice(0, 60));

    console.log('6) 農曆模式閏月選項');
    await page.click('label[for=cal-lunar]');
    const 閏 = await page.$eval('#leap-row', (el) => getComputedStyle(el).display !== 'none');
    console.log('   閏月選項 ' + (閏 ? '✓' : '✗'));
    if (!閏) 問題.push('農曆模式未顯示閏月選項');

    await page.click('.tab[data-view="chart"]');
    await page.screenshot({ path: __dirname + '/screenshot.png', fullPage: true });
    console.log('7) 已截圖 tools/screenshot.png');
  } catch (e) {
    if (e.message !== 'render-failed') 問題.push('[執行例外] ' + e.message);
  } finally {
    await browser.close();
    console.log('\n=== 結果：' + (問題.length === 0 ? '全部通過 ===' : `發現 ${問題.length} 個問題 ===`));
    問題.forEach((p) => console.log('  - ' + p));
    process.exitCode = 問題.length ? 1 : 0;
  }
})();
