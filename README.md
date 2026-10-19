# PSN Game Catalog

個人的 PlayStation 遊戲庫，基於 [promise82114/ps-game-base](https://github.com/promise82114/ps-game-base) 延伸。

## 線上網站

[開啟 PSN Game Catalog](https://chiarubi-728.github.io/PSN_Game_Catalog/)

- 合併 Sony 數位授權與 PSNProfiles 全部遊玩紀錄，包含數位庫沒有的遊戲。
- PS4／PS5 分開顯示，保留獎盃進度、白金與尚未白金紀錄。
- 交叉篩選平台、完成狀態、數位擁有、資料來源、完成率區間及個人分類。
- 名稱、完成率、獎盃數、來源順序與最近整理排序；條件可移除、一鍵清除。
- 資料存於使用者瀏覽器；GitHub 僅發布程式，不含私人遊戲庫、帳密或授權資料。

首次使用請匯入原本的完整備份。線上與本機使用不同的瀏覽器存檔；兩支 Tampermonkey 腳本請從本站更新至 0.2.3，以支援新網址回傳。[完整使用說明](docs/使用說明.md)。

## 本機啟動

需要 Node.js 20+，執行 npm start，開啟 http://localhost:4175/ 。

Sony 官方中英文名稱查詢需要本機 Node 服務；取得的名稱包含在完整備份中，可匯入線上版沿用。Google Drive 需要在 OAuth 設定允許新網站 origin。

## 發布

main 推送自動觸發 GitHub Pages，發布 dist/。Actions 為 JS／CSS 加上當次提交版號。原始碼無套件相依與建置步驟。驗證狀況見 [交接紀錄](docs/HANDOFF.md)。
