# 2026-10-20：側欄 PS Plus／非 PS Plus

基準 HEAD 1018572，main；開始時乾淨並與 origin/main 一致。使用者要求將原本的 PS Plus／非 PS Plus 篩選加到側欄。

新增 ps-plus／non-ps-plus 導航、標題、條件標籤與 session 還原。沿用原授權篩選邏輯，只按同平台卡片 digitalMembers 中明確 PS_PLUS／NONE 的授權標示判定；未知或純遊玩紀錄不推定非 Plus。混合授權可同時出現在兩個檢視，歷史資料保留，仍可搭配目前數位擁有篩選。沒有重加更多篩選中的數位授權或資料來源控制項，沒有更動分類、同步、存檔或腳本。

語法與 Git 差異檢查通過，未新增或執行測試。發布另依 Actions／HTTP 確認；不用更新 v0.3.1 腳本或重新同步。

---

# 2026-10-20：所有遊戲與尚未整理

基準 HEAD ee44cc4，main；開始時乾淨並與 origin/main 一致。使用者要求側欄增加所有遊戲與尚未整理，已標記或有任一自訂分類的遊戲不可出現在尚未整理。

新增 all／unorganized 側欄按鈕、標題及條件標籤，session 支援還原新檢視。尚未整理以來源沒有白金、個人狀態為未開始且 categories 為空判定；既有個人白金、忽略、追蹤、舊版狀態與任何分類均排除，筆記／標籤不當作分類。即時沿用 catalogRecordFor 的已保存／繼承整理，不更動原始資料或 schema。

整理後 render 會立刻將已整理項目移出清單及本檢視的勾選；其他檢視維持原來跨篩選保留選取的行為。尚未整理點自訂分類導航會切回 all 搭配該分類，避免互斥條件造成空清單。

只執行語法與 Git 差異檢查，未新增或執行測試。沒有修改腳本（仍 v0.3.1），發布另依 Actions／HTTP 確認。

---

# 2026-10-19：單一批次分類選單

基準 HEAD 58f4102，main；開始時乾淨並與 origin/main 一致。使用者要求勾選後只決定加入哪個分類，不要兩組狀態／分類工具。

移除 batch-status 與 apply-status，改由單一 batch-category 列出三種既有標記及自訂分類，搭配一個加入分類按鈕。選單值使用 mark:／category: 前綴防止同名資料混用；空選擇不可套用，重新 render 保留有效選擇。加入自訂分類採聯集，不動原分類、筆記及標籤；三種標記沿用互斥存檔。白金仍明示個人標記，來源獎盃統計與歷史不變。

儲存失敗會回復本次個人作品變更，跨分頁寫入保護沿用。沒有更動同步、整合腳本或資料格式；不需重裝 v0.3.1。只做語法與差異檢查，未新增或執行測試；發布另依 Actions／HTTP 確認。

---

# 2026-10-19：篩選折疊與腳本改名

基準 HEAD d8cf853，main；開始時工作樹乾淨且與遠端一致。使用者確認整個篩選區塊可折疊，腳本改名 PSN Game Catalog。

篩選外層改用原生 details／summary，預設收起，內含搜尋、排序及更多篩選。標題顯示條件數、排序及無效區間提示；收起不清除條件。原 session 格式新增可選 panelOpen／advancedOpen 布林，舊資料相容，同分頁重新整理記住展開狀態；toggle 只更新 session，不寫遊戲存檔。

整合腳本 @name 改為 PSN Game Catalog，版號 0.3.1；兩個來源面板名稱與顯示版號、前端安裝提示同步更新。namespace、儲存 key、JSON schema、檔案網址及同步協定不變。改名後請確認只保留 PSN Game Catalog 啟用，停用舊 PS Game Base 遊戲庫／獨立 PSNProfiles 腳本，以免重複讀取。

只執行語法與 Git 差異檢查，未新增或執行測試。部署另依 Actions 及線上 HTTP 確認；真實 Tampermonkey 安裝及同步由使用者瀏覽器驗收。

---

# 2026-10-19：完成率區間清除按鈕

基準 HEAD 99ebd3a，main；開始時乾淨並與遠端一致。依使用者要求，在獎盃完成率區間旁新增「清除」，只清空上下限並回第一頁，保留其他篩選。沿用 render 更新清單、條件標籤、錯誤提示與 session；上下限均空時停用按鈕。語法與差異檢查通過，未新增或執行測試。腳本版本維持 v0.3.0，不需重裝。

---

# 2026-10-19：精簡側欄與篩選

基準 HEAD 373b7c4，main；開始時乾淨並與 origin/main 一致。依使用者逐項確認：側欄只留白金／忽略／追蹤；完成狀態只留已白金、未白金、未 100%、尚無遊玩進度；來源只留數位擁有、非數位擁有（僅有遊玩紀錄）；移除 PC 選項及更多篩選的數位授權／資料來源。

尚無遊玩進度包含無紀錄、0% 與進度不詳；未 100% 包含已知進度小於 100%，不論白金與否，兩者可重疊。移除控制項及其條件判斷、事件和標籤，避免舊的 Sony／PS Plus 篩選隱藏結果。舊 session 的已移除 view／選項不還原，0%／無紀錄／不詳遷移到新選項；現存遊戲、PC／Sony 來源資料、原始授權與個人整理不刪除。左上品牌連結返回所有遊戲，清除篩選也會回到全部。

只修改網站顯示與篩選，整合腳本維持 v0.3.0，不需重裝。只做語法與差異檢查，未新增或執行測試；部署另依 Actions 及線上 HTTP 確認。

---

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
