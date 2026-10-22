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

## 2026-10-22：第二步跨站交接

使用者回報每次數位授權完成後，第二步立即顯示來源分頁已關閉，重試才成功。原實作重用 Sony WindowProxy 切到 PSNProfiles，外層仍以 closed 判定存活，來源端也依賴 opener。此組合會受到跨站 COOP 隔離影響；未以使用者瀏覽器重現，但程式路徑與回報吻合。

v0.3.3 新增 Tampermonkey 本輪專用回報通道，管理頁先完成註冊握手再導向來源，來源即使沒有 opener 仍可回報；沿用原帳號、完整性及儲存成功驗證，成功後才確認保存並繼續名稱步驟。數位階段仍檢查分頁是否關閉；遊玩階段依來源回報、錯誤、停止或 20 分鐘逾時處理。取消與過期回報不再接受，暫存會清理；未更新腳本時顯示具體更新提示。

改前版本 349f1c4，備份 outputs/backups/20261022-history-handoff/before-history-handoff-349f1c4.zip。腳本新增本機儲存與跨分頁通知 API 權限，不改 Google OAuth 範圍或帳號設定。隱私政策補充本機暫存用途與清理方式。只做語法、引用與 Git 差異檢查，未新增或執行測試，未以瀏覽器驗收。
