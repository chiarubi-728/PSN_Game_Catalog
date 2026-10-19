# 2026-10-19：一個入口，全部在線上

基準 HEAD 05774ba，main；開始時工作樹乾淨。使用者要求減少同步按鈕，並明確要求全部在線上處理。只修改自己的 chiarubi-728/PSN_Game_Catalog。

首頁只留「同步遊戲庫」與「資料管理」。新增 sync-ui.js 協調數位庫 → PSNProfiles 完整紀錄 → 官方名稱查詢。沿用同一個來源分頁、隨機 session、origin 及分頁物件驗證；數位庫純合併自動保存，不寫個人整理。部分失敗保留先前階段，重試從失敗階段開始。

整合腳本 v0.3.0 保留既有 @name／namespace 供更新，加入 PSNProfiles 與自己 Pages 的精確 @match。原生庫觀察器改以 unsafeWindow 取得網頁 fetch／XHR；PSNProfiles 讀取器延至 DOMContentLoaded。請停用舊的獨立 PSNProfiles 腳本。

新增 script-bridge.js，以同頁 origin／source／隨機 requestId 連到整合腳本，僅允許最多 4 個格式受限的公開商品。GM_xmlhttpRequest 只 connect store.playstation.com，anonymous、手動驗證重新導向及固定路徑、2 個並行、請求限時、大小限制、限流停止與取消。原本 Node 公開商品解析器同邏輯內嵌到整合腳本；不使用授權憑證，不依賴 loopback。官方名稱 UI 已移除 localhost API 路徑，名稱對照仍用原格式儲存／備份。

依 Tampermonkey 官方文件實作：[GM_xmlhttpRequest](https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest)、[unsafeWindow](https://www.tampermonkey.net/documentation.php?q=unsafeWindow)。這些文件支持 API 用法，不代表 Sony／Chrome 整輪同步已實測通過。

本次只執行語法、靜態來源與 Git 差異檢查，未新增或執行測試。沒有使用真實登入憑證或私人存檔；整合授權後的頁面 fetch 攔截、跨來源同分頁切換、PSNProfiles 驗證及 GM 商店請求，仍需使用者實際安裝 v0.3.0 後驗收。發布結果另外依 Actions 與線上 HTTP 確認。

---

# 交接紀錄

2026-10-19（Asia/Taipei）。首次發布基準為空儲存庫，目標為 chiarubi-728/PSN_Game_Catalog 的 main。

從本聊天完成的完整遊戲庫副本加入：Sony 數位授權、PSNProfiles 完整遊玩與獎盃匯入、自動合併中英文及平台獨立卡片、交叉篩選。沒有將另一個參考 repo 的後續工作覆寫或推送過去。

新增本庫 Pages workflow、靜態版名稱查詢提示、自己的 userscript 回傳 origin；兩支腳本版號 0.2.3。完整備份仍由使用者手動匯入，不發布私人資料。來源白金統計按主要來源 ID 去重，與個人標記分開。

只執行 JavaScript 語法與 Git 差異檢查，未執行測試或真實瀏覽器操作。發布結果需以 Actions 與線上 HTTP 另行確認；Google OAuth、Tampermonkey 登入來源及實際跨分頁同步待使用者使用的瀏覽器驗收。

即時官方名稱補齊只在 localhost 提供；Pages 可沿用備份的 storeNames。以相同 origin 操作，不混用 localhost、127.0.0.1 與 Pages，以免誤認存檔遺失。
