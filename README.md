# PSN Game Catalog

個人的 PlayStation 遊戲庫，基於 [promise82114/ps-game-base](https://github.com/promise82114/ps-game-base) 延伸。

## 使用線上版

[開啟 PSN Game Catalog](https://chiarubi-728.github.io/PSN_Game_Catalog/)

[隱私權政策](https://chiarubi-728.github.io/PSN_Game_Catalog/privacy.html) · [服務說明](https://chiarubi-728.github.io/PSN_Game_Catalog/terms.html)

1. 從「資料管理 → 首次設定／更新腳本」安裝「PSN Game Catalog」整合腳本 **v0.3.2**，並停用舊的「PS Game Base 遊戲庫」及獨立 PSNProfiles／獎盃助手腳本。更新後重新整理本網站及來源分頁。
2. 首次同步先設定自己的 **PSN Online ID**；已有舊數位庫時，需確認資料屬於該帳號。Google 帳號只用於雲端保存，不會代替 PSN 帳號。
3. 平常按 **同步遊戲庫**。在 Sony 分頁核對登入帳號並勾選確認後，同一個來源分頁依序讀取數位授權、PSNProfiles 全部遊玩／獎盃紀錄，最後自動補齊官方中英文名稱並合併。
4. Sony 登入與 PSNProfiles 網站驗證需在來源分頁完成。各階段顯示進度，中途失敗保留已保存的部分，可重試未完成步驟。Sony 帳號確認由使用者核對，腳本不會自動驗證登入身分。

所有日常功能都在瀏覽器完成，不需要安裝 Node、啟動本機助手或轉移本機名稱資料。首次若已有完整備份，可從資料管理匯入；網站原有存檔沿用。

## 遊戲庫

- 合併數位擁有與所有遊玩紀錄，包含數位庫沒有的遊戲。
- PS4／PS5 分開；白金和 100% 完成分別判定。
- 跨平台卡片依已確認的名稱對照優先統一顯示中文名稱，例如「天命2 · PS4／PS5」；英文名稱仍可搜尋，授權、進度與獎盃各自保留。
- 已確認的系列名支援中英文互搜，例如「戰地／Battlefield」；Battlefield V 與戰地風雲 5 也有名稱對照。商品 ID 已確認的現行名稱優先於舊遊戲庫標籤。
- 保留側欄分類導航，清單依名稱排列；獨立搜尋欄可依中英文名稱及已保存別名搜尋目前分類。
- 個人分類、標籤、筆記與手動白金標記保留；已取得白金統計依來源 ID 去重。
- 補齊名稱而重新配對時，沿用來源卡片的個人整理；獨立狀態衝突先保留忽略，舊筆記可在編輯視窗查看。白金清單也包含個人白金標記。
- 切換搜尋、側欄或排除條件會清除勾選；自訂分類獨立顯示。儲存失敗時保留編輯內容，讀檔失敗時鎖定寫入並提供原始存檔匯出與完整備份復原。
- 標記「忽略」的遊戲只在「忽略」清單顯示，所有遊戲、白金、PS Plus／非 PS Plus 與自訂分類都隱藏；解除忽略後恢復依原資料分類。
- 資料先存於目前瀏覽器，可設定 Google Drive 自動同步（試用）。網站已提供共用的公開 OAuth Client ID，直接按 Google 登入；換裝置登入同一 Google 帳號。自架網站可另設自己的 OAuth 設定。設定見 [雲端同步說明](docs/CLOUD_SYNC.md)。GitHub 不保存私人資料。

[使用說明](docs/使用說明.md) · [交接紀錄](docs/HANDOFF.md)

## 開發與發布

原生 HTML／CSS／ES modules，無建置步驟；main 推送自動以 GitHub Actions 發布 dist/，並更新 JS／CSS 快取版號。需要本機預覽時可用 Node.js 20+ 執行 npm start，但線上功能不依賴此服務。
