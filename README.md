# PSN Game Catalog

個人的 PlayStation 遊戲庫，基於 [promise82114/ps-game-base](https://github.com/promise82114/ps-game-base) 延伸。

## 使用線上版

[開啟 PSN Game Catalog](https://chiarubi-728.github.io/PSN_Game_Catalog/)

1. 從「資料管理 → 首次設定／更新腳本」安裝「PSN Game Catalog」整合腳本 **v0.3.1**，並停用舊的「PS Game Base 遊戲庫」及獨立 PSNProfiles／獎盃助手腳本。更新後重新整理本網站及來源分頁。
2. 平常按 **同步遊戲庫**。同一個來源分頁依序讀取 Sony 數位授權、PSNProfiles 全部遊玩／獎盃紀錄，最後自動補齊官方中英文名稱並合併。
3. Sony 登入與 PSNProfiles 網站驗證需在來源分頁完成。各階段顯示進度，中途失敗保留已保存的部分，可重試未完成步驟。

所有日常功能都在瀏覽器完成，不需要安裝 Node、啟動本機助手或轉移本機名稱資料。首次若已有完整備份，可從資料管理匯入；網站原有存檔沿用。

## 遊戲庫

- 合併數位擁有與所有遊玩紀錄，包含數位庫沒有的遊戲。
- PS4／PS5 分開；白金和 100% 完成分別判定。
- 保留側欄分類導航，清單依名稱排列；獨立搜尋欄可依中英文名稱及已保存別名搜尋目前分類。
- 個人分類、標籤、筆記與手動白金標記保留；已取得白金統計依來源 ID 去重。
- 資料存於目前瀏覽器。GitHub 只發布程式，換裝置請匯出完整備份；Google Drive 備份為選用功能，另需 OAuth 允許此網站。

[使用說明](docs/使用說明.md) · [交接紀錄](docs/HANDOFF.md)

## 開發與發布

原生 HTML／CSS／ES modules，無建置步驟；main 推送自動以 GitHub Actions 發布 dist/，並更新 JS／CSS 快取版號。需要本機預覽時可用 Node.js 20+ 執行 npm start，但線上功能不依賴此服務。
