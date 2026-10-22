# 專案交接

更新：2026-10-22

## 正式來源

- 儲存庫：chiarubi-728/PSN_Game_Catalog，分支 main。
- 網站：https://chiarubi-728.github.io/PSN_Game_Catalog/
- 公開介紹：https://chiarubi-728.github.io/PSN_Game_Catalog/about.html
- 維護方式與目錄：[維護指南](MAINTENANCE.md)。操作功能：[使用說明](使用說明.md)。

## 必須保留的行為

- dist 是原始碼；主程式入口為 index.html → app.js。部署不需打包。
- localStorage 鍵 ps-game-base.v1、舊備份格式與來源識別沿用；PS4／PS5 分開保存。
- 平台、標記、自訂分類、搜尋與完成率各組取交集；同組複選取聯集。
- 忽略預設只在忽略清單顯示；明確勾選忽略篩選後仍須符合其他條件。
- 右上快捷操作立即儲存，卡片暫留當頁；切換瀏覽條件後重算。左下白金、右下 PS Plus。
- 雲端使用版本與 ETag 保護，取得不到保護碼時停止寫入；權杖只在記憶體。
- 整合腳本的既有安裝路徑 dist/scripts/ps-game-base.user.js 保持可用。

## 本次整理

移除退役的獨立白金介面、舊篩選介面、舊 PSNProfiles 腳本與專屬測試、本機助手、舊商店查詢 API 及未引用的預覽圖。刪除舊介面的 CSS 與未使用匯入。保留舊備份相容解析、仍被引用的 Sony ID 處理、歷史比對函式及其既有測試。

原逐次交接紀錄可由整理前版本 d0fbb79 的 docs/HANDOFF.md 或 outputs/backups/20261022-project-cleanup/before-cleanup-d0fbb79.zip 取回。

本次僅作語法、模組引用、HTML 靜態連結與 Git 差異檢查；未新增或執行測試，未進行瀏覽器互動驗收。Google 品牌審查狀態需由管理者在 Console 確認。
