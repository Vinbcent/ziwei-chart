'use strict';
/**
 * Vercel Serverless 入口：將所有請求轉交給 Express 應用。
 * server.js 僅在直接執行時才會 listen，於此處只取其 app 實例。
 */
module.exports = require('../server.js');
