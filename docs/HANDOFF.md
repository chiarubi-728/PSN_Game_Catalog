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

## 2026-10-22：移除最後遊玩時間（v0.3.6）

依使用者要求，資料覆蓋不足的最後遊玩日期不再出現在排序與詳細資料。保留名稱、取得／領取與最後獲得獎盃排序，Sony 取得先後順序備援仍在。腳本刪除 gamelist 與 getUserGameList 請求、對應狀態與匯出新資料；主頁不再做 playActivity 的卡片配對計算。model／dates 舊欄位白名單及 merge 相容保留，現有備份與資料不因功能退役而清除。

更新版號 v0.3.6，同步前最低版號同步更新。操作說明與隱私政策改成現行兩種日期。原始碼備份 outputs/backups/20261022-remove-last-played/before-remove-last-played-ca42842.zip，先前輸出 ZIP 也保留。已調整既有日期測試案例以對應退役功能；本輪未新增或執行測試，只做語法、引用、HTML 靜態檢查與 Git 差異檢查。

## 2026-10-22：八項同步與介面調整（v0.3.7）

使用者完成一輪無痕測試後同意修改八項：Sony 自動帶入 PSN 帳號、讀完自動接下一步、缺腳本安裝提示、平台／標記三段式篩選、移除清除平台／分類、PS3／PS Vita 標籤（無 PC）、收起例行說明／診斷／結果數、縮窄搜尋與欄內 ×。本輪原始碼備份 outputs/backups/20261022-sync-and-filter-ui/before-sync-and-filter-ui-516885f.zip，原輸出 ZIP 也保留。

新增 source-relay.js 與 userscript psgbSonyRelay：主頁先註冊本輪隨機 session、profile、期限，Sony 精確對應或僅唯一有效任務時恢復，密碼／Cookie／Bearer 不進 GM 暫存。Sony 結果經主頁驗證帳號與保存成功才繼續；PSNProfiles 回報通道預先建立後，透過 Sony 原頁執行已驗證的跨站導航，避開 COOP 的 closed／opener 依賴。所有 postMessage 仍檢查來源／隨機 session，來源導航只允許預期 PSNProfiles profile，暫存有大小無關的任務數上限與 15 分鐘期限。多任務無法唯一對應不猜帳號。取消與主頁離開清理。歷史來源仍用原 20 分鐘通道。

篩選使用互斥的 included／excluded Sets，循環 none/include/exclude；排除先剔除，選取同組 OR、各組 AND，自訂分類維持 checkbox 多選；不改 personal 或來源白金。已有忽略預設隱藏政策沿用，只有明確選取忽略時帶出。所有條件進入 browsingContext，避免暫留卡片干擾新篩選。標籤預留 +/- 記號寬度，新增 PS3、PS Vita，移除動態 clear 按鈕；結果數改為讀屏可讀、視覺隱藏。三段式有文字 aria-label，排除使用紅色減號。

安裝提示以腳本未回應為依據，不嘗試列舉擴充功能；附官方 Tampermonkey 與固定腳本安裝 URL，說明啟用及無痕權限。主頁／資料管理刪除冗長說明；Sony 技術資料與匯出等收進 advanced details，帳號勾選與操作錯誤保留。隱私政策補充 Sony 本機暫存用途與清理。沿用存檔鍵與備份、Google 權限／衝突處理不變。

本輪未新增或執行自動化測試。語法、模組與 HTML 靜態檢查之外，會查看人工資料預覽；實際 Sony 登入跳轉及無痕擴充套件交接仍需要使用者更新後確認。

人工預覽補充：使用獨立 127.0.0.1:4189 的五款人工資料（PS5／PS4／PS3／PSVITA），查看 PS5 選取＋白金排除後只顯示非白金 PS5 卡，縮窄搜尋與欄內 ×、隱藏例行長文均已呈現。未安裝腳本的 IAB 點同步後顯示安裝與無痕權限引導，來源空白頁會清理。預覽 console 無 error。沒有連接真實 Sony 或 Google 帳號。預覽匯入先前一次因人工資料漏 favorite／rating 被正確拒絕，已修正該本機範例，不涉及使用者資料。

## 2026-10-22：首次登入恢復與結果數（v0.3.8）

使用者實測已登入 Sony 時可帶入帳號，無痕首次登入跳轉後卻失去帳號；三步完整成功的畫面已由使用者提供。原程式丟失 hash 後只依唯一待處理任務恢復，無分頁專屬識別；有多個殘留任務時會停止恢復，這是程式可確認的缺口，尚未證實為該次真實登入的唯一原因。

主頁註冊本輪任務後，先將來源分頁開到本站 sony-launch.html。腳本驗證該輪 request 後，使用 GM_getTab／GM_saveTab 保存分頁識別，等待保存回呼完成並重驗任務有效，再 location.replace 到固定 Sony 已購買頁；因此首次 Sony 直接 HTTP 登入重導、尚未注入來源腳本時也不會失去本輪對應。啟動頁沒有網站登入或資料讀取，啟動失敗停留顯示重試提示，外層原逾時仍生效。

Sony 來源另先同步保存 sessionStorage 識別，再非同步讀／寫上述分頁紀錄。登入後優先取本分頁綁定，不受其他有效任務數影響；識別只含 session 與 managerOrigin，帳號仍從有效的原 request 取得，取消／過期／來源不符時不改選其他任務。恢復不延遲 Sony 網路攔截；若面板已建立則補填帳號、恢復唯讀並開啟面板，確認勾選保持未勾選。pagehide 保留分頁識別、解除監聽；BFCache pageshow 重新綁定並讀待處理控制。NEXT／FINISH、逾期及無效識別清理。API 語意參考官方文件 https://www.tampermonkey.net/documentation.php?q=GM_tabs 。腳本新增兩項分頁 API grant，最低版本與安裝提示同步至 v0.3.8。

完整同步 mode=all，三步 dataset.state 都 done、各階段保存及名稱合併完成後，延遲一秒收起同步對話框。新同步、手動關閉或重新顯示會取消舊計時；失敗與部分同步不自動關閉。未關閉來源網站分頁。

移除卡片暫留的說明與分類管理說明，只移除顯示，原卡片暫留、分類重新命名／刪除行為保留。移除上方數位擁有／遊玩來源數字及引用；result-count 恢復可見且固定「共 XX 款遊戲」，使用目前全部 filtered.length，頁碼不影響總數。仍以同一作品／平台卡為單位，清單右側選取按鈕保留。

備份：outputs/backups/20261022-login-return-and-count/before-login-return-746724a.zip，另保留原輸出 ZIP。未改使用者資料、備份格式或 Google 權限。僅執行語法、引用、HTML ID 及 Git 差異靜態檢查，未新增或執行測試；無痕 Sony 首次登入、真實來源交接與自動收起仍需使用者更新腳本後確認。

## 2026-10-22：安裝後下一步提示

使用者回報從同步視窗更新腳本後，原頁停留在更新提示，不清楚需要重整及重新啟動同步。安裝提示增加第 3 步按鈕「已完成安裝，重新整理主頁」，說明放在安裝按鈕上方，明確告知回到此分頁、按第 3 步、重整後按右上角同步。版本不符的錯誤訊息也顯示同樣後續動作。按鈕僅在使用者點擊時 location.reload，不自動判定安裝成功、不自動重試或開啟來源頁；同步仍在進行或資料保存提示未處理時保留原頁並提醒。沿用既有離頁保護。

本次僅改網頁及說明文件，userscript 維持 v0.3.8。原始碼備份 outputs/backups/20261022-script-install-guide/before-install-guide-1b96f65.zip，另保留原輸出 ZIP。29 個 JS 靜態語法、引用、HTML ID 及 Git 差異檢查通過；未新增或執行測試。
