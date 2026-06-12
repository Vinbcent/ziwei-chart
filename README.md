# 紫微斗數排盤工具

自製排盤引擎（不依賴第三方排盤庫）＋網頁排盤介面＋供 LLM 服務呼叫的 API。

支援：**本命盤、大限、小限、流年、流月、流日、流時**，全繁體中文。

## 快速開始

```bash
npm install
npm start
```

- 網頁排盤：<http://localhost:3000>
- API 文件（機器可讀，可直接餵給 LLM 當工具說明）：<http://localhost:3000/api/v1/doc>

## API

### `GET/POST /api/v1/natal` — 本命盤

| 參數 | 說明 |
|---|---|
| `calendar` | `solar`（國曆，預設）或 `lunar`（農曆） |
| `year` / `month` / `day` | 出生年月日（依 `calendar` 解讀） |
| `isLeapMonth` | 是否閏月（僅農曆輸入時，預設 `false`） |
| `timeIndex` | 時辰 0–12（0=早子、1=丑 … 11=亥、12=晚子）；或改用 `hour`（0–23） |
| `gender` | `male`/`female` 或 `男`/`女` |

```
GET /api/v1/natal?year=2000&month=8&day=16&timeIndex=2&gender=female
```

### `GET/POST /api/v1/horoscope` — 本命盤＋運限

本命參數同上，另加：

| 參數 | 說明 |
|---|---|
| `targetDate` | 運限目標日 `YYYY-MM-DD`（國曆，預設今日） |
| `targetTimeIndex` | 目標時辰 0–12（流時用，預設 0）；或改用 `targetHour` |

```
GET /api/v1/horoscope?year=2000&month=8&day=16&timeIndex=2&gender=female&targetDate=2026-06-12&targetHour=10
```

回傳 `data.本命`（十二宮、星曜、亮度、生年四化、神煞、大限區間、小限歲數）與
`data.運限`（大限／小限／流年／流月／流日／流時各層的宮位、干支、該層四化、流曜、宮名重排）。

宮位索引慣例：**寅宮 = 0**，順時針至丑宮 = 11。

### 給 LLM 服務串接

`GET /api/v1/doc` 回傳完整的端點、參數、回應結構說明（JSON），
可直接作為 function calling / tool use 的工具描述來源。
回應全為結構化繁體中文 JSON，便於 LLM 解盤論述。

## 專案結構

```
src/
  calendar.js    農曆曆法（1901–2099 國曆↔農曆、四柱干支、五虎遁、五鼠遁）
  constants.js   安星資料表（四化、祿存魁鉞、雜曜表、納音五行局…）
  brightness.js  星曜亮度表（廟旺得利平不陷，由傳統表轉寫）
  stars.js       安星訣（十四主星、輔星、雜曜、流曜）
  chart.js       本命盤組裝（命身宮、五行局、神煞、大限小限）
  horoscope.js   運限（大限、童限、小限、流年、斗君流月、流日、流時）
  index.js       對外入口
server.js        Express API ＋靜態網頁
public/          網頁排盤介面、API 文件
test/verify.js   驗證測試（與開源庫 iztro 隨機命例全盤比對，僅開發期使用）
tools/           開發期資料表萃取工具（僅開發期使用）
```

## 排盤口徑（本引擎採用之派別約定）

- **年界**：以農曆正月初一換年（非立春）。
- **晚子時**（23:00–00:00，`timeIndex=12`）：採「翌日子時」法——日柱與日系星曜依翌日，
  月、年不變；起紫微之日數若超過當月天數則回繞至初一。
- **閏月**：閏月十六（含）之後依下月安星（命宮與月系星曜），月柱與流月亦進位。
- **大限**：起運歲數＝五行局數，陽男陰女順行、陰男陽女逆行。
- **童限**：虛歲未達起運歲數時，依「一命二財三疾厄、四歲夫妻五福德」取宮。
- **庚干四化**：太陽、武曲、太陰、天同。
- **流月**：斗君法（流年支宮起正月逆數至生月，再順數至生時）。

## 驗證

排盤邏輯為自行轉寫，並以開源排盤庫 [iztro](https://github.com/SylarLong/iztro)（MIT）作為開發期對照組：

```bash
npm run verify   # 隨機 500 命例，逐宮逐項比對（含全部運限層）
```

最近一次驗證：**1500/1500 命例完全一致**（含農曆轉換 1901–2099 全段抽查）。
iztro 僅列於 devDependencies，正式執行（`npm start`）不需要它。
