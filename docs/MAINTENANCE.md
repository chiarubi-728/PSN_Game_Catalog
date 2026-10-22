# 維護指南

## 目錄

| 路徑 | 用途 |
| --- | --- |
| `dist/index.html`、`app.js`、`style.css` | 主介面與入口；dist 是原始碼，不是可刪除的產物 |
| `dist/catalog*.js`、`browse-filters.js` | 遊戲合併、命名、搜尋與篩選 |
| `dist/dates.js`、`catalog-sort.js` | 日期驗證、日期覆蓋與未知日期排序 |
| `dist/model.js`、`history.js`、`store-names.js` | 資料格式、舊備份相容、獎盃與官方名稱 |
| `dist/sync-ui.js`、`script-bridge.js`、`source-relay.js`、`scripts/` | 整合同步與使用者腳本；保留現有安裝 URL |
| `dist/sony-launch.html` | 在 Sony 登入跳轉前，先由整合腳本為來源分頁保存本輪同步識別 |
| `dist/cloud-sync.js`、`shared/` | Google 登入、雲端版本比對與保存 |
| `dist/about*`、`privacy.html`、`terms.html`、`policy.css` | 公開介紹與政策頁 |
| `docs/` | 操作說明、雲端設定與交接 |
| `docs/history/` | 歷次修正與排查紀錄；目前操作與狀態以其他文件為準 |
| `tools/check-static.mjs` | 語法與靜態引用檢查，不執行應用程式 |
| `tools/version-assets.mjs` | 部署時統一更新 HTML 與模組的快取版號 |
| `server.mjs` | 本機靜態預覽，不提供舊商店查詢 API |
| `tests/` | 既有測試與範例，需使用者要求測試時才執行 |
| `.github/workflows/deploy.yml` | main 推送後發布 dist 至 GitHub Pages |

## 指令

需要 Node.js 20+，沒有第三方套件，不必 npm install。

```sh
npm start
node tools/check-static.mjs
```

本機預覽預設只監聽 `127.0.0.1:4175`；可用 PORT 環境變數指定其他連接埠。瀏覽器資料依來源分開，請沿用既有網址與連接埠。正式網站不依賴本機服務。

靜態檢查只確認語法、引用與 HTML ID；不能代替登入、雲端衝突、分類等實際操作驗收。不會自動執行既有測試。

## 清理原則

- 刪除前先備份；不要上傳私人遊戲庫、權杖、登入憑證或瀏覽器匯出。
- `dist/platinums.js` 與其測試仍保留歷史比對邏輯；`dist/sony-platinums.js` 仍提供現行遊戲配對使用的 gameTitleId，不能直接刪除。
- 不因檔名含有舊專案名就改名：存檔鍵、備份 kind 與腳本 URL 都是相容介面。
- 整理前完整原始碼與舊交接紀錄可由 Git 版本 `d0fbb79` 取回；工作區另外有備份 ZIP。
- 一次性開發腳本與調查資料屬於本機 work 歸檔，不放進正式儲存庫或部署目錄。

[文件目錄](README.md) · [目前交接狀態](HANDOFF.md)
