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

## 2026-10-22：主頁回報相容性與同步前檢查

使用者更新 v0.3.3 並重新整理遊戲庫主頁後，Sony 來源已完成 594 筆數位授權，但主頁等不到 RELAY_READY。上一版只接受 event.source === window；擴充套件送出的 postMessage 回覆可能 source === null（MDN 的 postMessage 擴充套件說明），因此有效回覆會被忽略。仍未在使用者瀏覽器重現，這是依錯誤畫面與程式接收條件提出的修正。

網站端的通道握手、轉送回報與名稱查詢回覆現在接受 window 或 null，但仍須精確符合 location.origin、訊息類型與本輪隨機 session／requestId；原 Sony／PSNProfiles 跨站直接回報的來源 WindowProxy 驗證維持原規則。整合腳本仍為 v0.3.3，不必再次安裝。

一般同步與只更新遊玩紀錄會先用既有 PING 確認主頁腳本版本及通訊，再讀來源；先在使用者點擊當下開空白分頁，避免非使用者手勢造成彈窗封鎖。失敗／取消只關閉該輪未使用的 about:blank 分頁；沒有回應時改為提示主頁的 Tampermonkey 啟用與網站執行權限，不一律要求重裝。只更新數位授權與只補名稱保留各自流程。

基準 7ef9356，備份 outputs/backups/20261022-page-bridge/before-page-bridge-7ef9356.zip。只做語法、引用與 Git 差異檢查，未新增或執行測試，未進行實際帳號同步。資料格式、Google 權限與整合腳本內容均未更改。

## 2026-10-22：日期排序試作（v0.3.4）

使用者同意先備份再試作取得／領取、最後遊玩、最後獲得獎盃三種日期排序。名稱排序仍是預設，支援正反序、缺日期永遠最後、依目前篩選結果顯示覆蓋款數。卡片只有日期排序時顯示該日期，詳細資料可展開三項日期。

日期可選欄位：library.games acquiredAt／lastPlayedAt、library.playActivity（白名單 titleId／platform／name／lastPlayedAt）、library.dateSync 安全狀態碼，以及 history.games lastTrophyAt。舊備份不需遷移；同步缺日期仍保留已知日期，未知不使用同步時間代替。Sony activeDate 是授權啟用／領取，不是付款日期；同卡多授權用最早已知取得日期，遊玩與獎盃用最新。僅唯一相同平台配對能補實體卡的遊玩日期，歧義維持未知。

腳本新增 m.np.playstation.com 的兩個固定 API 與可選近期遊玩網頁查詢，逐頁讀取、設上限、可停止，失敗不阻止主要完整遊戲庫保存。Bearer 只留來源記憶體，不進跨頁通道、備份或記錄。PSNProfiles 讀實際獲獎 log，最多 80 頁／約 90 秒，不繞網站驗證；沒有時區的日期維持日精度。首次大量舊資料可能缺漏。透過既有暫存通道傳回已知日期以減少後續讀取。更新腳本至 v0.3.4 並同意新增連線權限後需重新整理主頁及來源頁。保留先前 source===null 回覆相容與同步前 ping 檢查。

原始碼備份：outputs/backups/20261022-date-sorting/before-date-sorting-7a41046.zip。原瀏覽器資料未由工具讀取；網站第一次載入有舊資料時先存 ps-game-base.before-date-sorting.7a41046 副本，再解析／儲存，主存檔鍵仍為 ps-game-base.v1；匯出更新前備份入口可下載。空間不足會鎖寫並提示備份。

驗證：13 項新增測試通過，含真正第二頁與重複分頁停止、舊備份相容、歧義配對、取消與輔助來源失敗；28 個 JS 語法／模組／HTML 檢查通過。IAB 使用獨立 4187 來源與人工三款資料，確認三種排序、雙向未知最後、日期覆蓋數、重新載入、詳細日期、更新前副本下載，無 console error。未連線到使用者真實 Sony／PSNProfiles 帳號，需使用者更新後同步確認日期覆蓋率。

全套原本 65 項中 29 項失敗，加入本次測試後仍為同樣 29 項：3 項舊白金配對預期與 26 項已不符合多閉包腳本結構的 VM 測試鉤點。已從修改前 ZIP 另解出基準執行，失敗名稱集合一致；沒有把它們算成全通過。測試報告與人工資料留本機 work/archive/2026-10-22，不部署。

## 2026-10-22：日期皆零的實際備份（v0.3.5）

使用者更新並重新同步 v0.3.4 後，實際備份有 594 筆授權，acquiredError／playedError 均為 NO_TOKEN，playActivity 為空，76 筆獎盃日期仍在。可證實不是排序 comparator 失效；目前 Sony 網頁工作階段沒有 mobile API 所需 Bearer。上一版 getUserGameList 備援另用 limit 1000，參考實作明列最大 100；而且 catch 丟掉備援錯誤，因此不能由這份備份判斷備援的實際 HTTP／GraphQL 原因。

修正：網頁近期遊玩 limit 改為 100，使用既有 cookie session，保留安全 webPlayedError（NO_DATA、HTTP、GRAPHQL_ERROR 等）並在零日期摘要顯示原因。回報與 JSON 匯出增加完整 ACTIVE_DATE desc 查詢的 acquisitionOrder 授權 ID 陣列，格式驗證拒絕重複、陌生 ID、不完整快照；不以 mergeLibrary 的既有 Map 插入次序代替。日期不足時取得排序改用這份順序，同一卡多筆授權取最早的順位，無順序排最後，畫面明確說明沒有確切日期。已知日期仍保留，從不以序號或同步時間偽造日期。

備份：outputs/backups/20261022-sony-date-fix/before-sony-date-fix-785233f.zip；使用者提供的當前備份僅另存本機 current-library-before-fix.json，不進公開 Git。原網站更新前副本鍵保留，不再覆寫。v0.3.5 需更新腳本並重新整理主頁／Sony 來源，進階「只更新數位授權」可重試這兩項，獎盃日期不受影響。沒有新增權限或改動 Google 設定。

17 項日期測試通過，新增 4 項涵蓋無 Bearer 的網頁備援、100 筆上限、安全錯誤保存與摘要、取得順序合併／雙向排序及非法順序。28 個 JS 靜態檢查通過。仍無使用者 Sony 登入工作階段，不能宣稱真實近期遊玩 API 已成功；limit 100 修正待使用者同步實測。

來源：PSN API getRecentlyPlayedGames.ts 與 operationHashes.ts 確認回應欄位及近期查詢結構；FriendsOfGalaxy/galaxy-integration-psn src/psn_client.py 明列 DEFAULT_LIMIT=100 為最大值。手機 API 對照 PSNAWP GameEntitlements；僅作輔助，不要求使用者提供憑證。

本輪瀏覽器驗收：獨立 localhost:4187 人工資料，零日期但有取得順序時正反排序生效，無順序最後，HTTP 503 安全提示顯示，console 無 error。真實備份解析前後授權 594、遊玩 213、獎盃日期 76、personal JSON 完全一致。全套 82 項中 53 通過、29 失敗，失敗名稱集合與最初基準一致，沒有新增失敗。
