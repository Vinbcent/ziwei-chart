'use strict';
/**
 * 紫微斗數排盤引擎 對外入口
 *
 * 用法：
 *   const { 排盤, 排運限 } = require('./src');
 *   const 本命 = 排盤({ 曆別: 'solar', 年: 2000, 月: 8, 日: 16, 時辰: 2, 性別: '女' });
 *   const 運限 = 排運限(本命, { 年: 2026, 月: 6, 日: 12, 時辰: 5 });
 */
const { 排盤, 解析生辰 } = require('./chart');
const { 排運限 } = require('./horoscope');
const 曆 = require('./calendar');

/** 對外輸出時移除內部欄位 */
function 清理(本命) {
  const { _內部, ...rest } = 本命;
  return rest;
}

module.exports = { 排盤, 排運限, 解析生辰, 清理, 曆 };
