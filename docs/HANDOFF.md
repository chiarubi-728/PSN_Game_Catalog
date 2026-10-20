# 2026-10-20：加入 Search Console 網站擁有權驗證

使用者提供完整 google-site-verification meta 標記，授權加入首頁並發布。基準 HEAD b633a4d，更新前程式碼備份於 outputs/backups/20261020-site-verification/before-site-verification-b633a4d.zip。僅將提供的公開驗證標記放入 dist/index.html 的 head；未更改資料或同步流程。驗證完成後需保留標記，以維持網站擁有權。Google Search Console 的「驗證」與 OAuth 品牌重新驗證仍由使用者操作；網站部署不代表 Google 已通過驗證。僅檢閱來源、Git 差異與部署狀態／HTTP，未新增或執行測試。

---
# 2026-10-20：補齊 OAuth 品牌的公開說明頁

使用者要從測試模式對外發布，Google 主控台因品牌缺少名稱、支援信箱、首頁與政策等資訊停用發布按鈕。基準 HEAD b64346b，更新前原始碼已備份至 outputs/backups/20261020-oauth-branding/before-oauth-branding-b64346b.zip。

新增 dist/privacy.html、terms.html 與獨立 policy.css，不載入應用程式、登入或同步腳本。政策依現有實作揭露 Google scope、識別碼、權杖記憶體保存、瀏覽器／Drive 儲存、外部連線、移除方式與共用電腦限制。聯絡使用既有公開 GitHub Issues，未公開使用者私人信箱。首頁新增政策與服務說明連結、更新標題及描述，雲端設定新增資料處理說明；遊戲與同步模型未更動。僅來源、Git 差異及部署 HTTP 檢查，未新增或執行測試。Google Cloud 發布、品牌與網域驗證仍由擁有者在主控台操作，部署成功不代表 OAuth 已公開。

---

# 2026-10-20：設定網站共用 Google Client ID 與直接登入

基準 HEAD 2587af4，開始時乾淨並與 origin/main 一致。使用者確認要讓新裝置與朋友直接 Google 登入，並明確提供公開 Client ID：565579076533-u41tbuhceaeb2ne8qoca7npkecasqkbj.apps.googleusercontent.com，授權設為網站預設並發布。

DEFAULT_CLIENT 改為擁有者提供值。新裝置無覆寫時使用網站設定，既有有效自訂 Client ID 繼續保留，避免不經確認切換 Drive 應用程式資料空間。主畫面雲端按鈕未登入時顯示「Google 登入」並直接呼叫授權；登入後顯示「雲端設定」供同步管理。自訂欄位改為選填並說明一般使用不需修改。沒有加入 Client Secret，也未將 Google 身分或遊戲資料寫入公開原始碼。資料仍依各自 Google sub 與 OAuth 應用程式綁定。

OAuth 測試名單仍需由擁有者管理；這次不會自動改 Google Cloud 發布狀態。更新前原始碼備份位於 outputs/backups/20261020-default-google-client/before-default-google-client-2587af4.zip。僅做語法、來源及 Git 差異檢查，未新增或執行測試；發布依 Actions／HTTP 確認，真實 Google 授權與跨裝置流程未代使用者操作。

---

# 2026-10-20：顯示 Drive API 拒絕存取的具體原因

基準 HEAD 891594b，開始時乾淨並與遠端一致。使用者已完成 OAuth，但同步只顯示籠統 403；不能據此斷言一定是 API 未啟用。更新 shared/drive-appdata.js，解析 Google error.errors 與 google.rpc.ErrorInfo 的 reason，顯示 HTTP／原因代碼，並區分同一 OAuth 專案 API 未啟用、授權 scope 不足、Workspace 政策、容量與限流。僅允許顯示安全格式原因字串和 projects/數字，未顯示完整回應、權杖或請求標頭。未更動遊戲存檔與雲端寫入流程。

發布前原始碼封存在 outputs/backups/20261020-drive-diagnostics/before-drive-diagnostics-891594b.zip。只做語法與差異檢查，未新增或執行測試；需使用者重新按立即同步取得實際原因後再針對設定處理。官方依據：https://developers.google.com/workspace/drive/api/guides/handle-errors 。

---

# 2026-10-20：授權備份後發布自動雲端同步

使用者已將「先不要 push」改為「乾脆 push，但先做好備份」，允許本次推送與 Pages 發布。基準 HEAD 645fc84，與 origin/main 一致。

發布前備份存於 outputs/backups/20261020-174410：正式版 git archive ZIP、完整 repository bundle（已通過 git bundle verify）、本機修改的 dist／docs／README 草稿 ZIP，以及含 SHA-256 的 backup-manifest.json。建立 annotated tag backup/before-auto-cloud-20261020-174410，指向舊正式版，與 main 一起推送。這些是程式及 Git 歷史備份；使用者實際遊戲資料在其瀏覽器，工具能存取的正式站分頁為空資料，未把空白匯出當作其私人資料備份。發布保留原 localStorage key 與備份 schema，雲端操作需使用者主動連接。另加入每個瀏覽器首次開啟新版時的原始存檔快照，讀取前以 RELEASE_BACKUP_KEY=ps-game-base.before-auto-cloud.645fc84 保存一次；資料管理可匯出更新前備份，空間不足時先暫停雲端，直到使用者匯出完整備份。此原始副本只在原瀏覽器，尚不是已下載至磁碟的私人資料備份。

使用者在本機授權實際遇到 origin_mismatch，原因為參考專案 Client ID 未允許來源。發布時移除原專案預設值，未設定自己的公開 Client ID 前顯示待設定並停用 Google 連接。不能聲稱 push 即修好 Google OAuth；仍需擁有者建立／允許正式來源 https://chiarubi-728.github.io，並完成真實 Drive 讀寫驗收。此設定在瀏覽器保存，未發布私人資料或權杖。

自動同步實作詳見下一筆交接與 docs/CLOUD_SYNC.md。僅做語法與靜態來源／Git 差異檢查，未新增或執行測試。發布完成另依精確 commit 的 Actions／HTTP 檢查。

---

# 2026-10-20：Google Drive 自動同步本機草稿，禁止 push

基準 HEAD 645fc84，main；使用者明確要求「自動同步先試試，先不要 push」。所有修改留在本機，未 commit／push／部署。保留正式版線上狀態。

新增 dist/cloud-sync.js，把原 app 內手動上下載改為連接後自動比較快照與修改佇列。獨立 META 儲存最後同步雜湊、Google sub 及 OAuth client 綁定；原遊戲 schema／備份不變。persist 通知變更，套用雲端用 fromCloud 抑制回圈。完整載入採整份替換，保留分類刪除；只有單邊變更自動套用，雙邊變更／首次兩份不同資料／換帳號／雲端刪除時選擇版本，切換前先存兩份可匯出的本機復原備份。

主畫面常駐雲端狀態，資料管理提供連接、立即同步、衝突選擇、備份匯出及公開 Client ID 設定。連接後 1.4 秒 debounce、前景 30 秒檢查、online／focus 重試，已驗證遠端快取避免重複下載。版本、ETag、上傳讀回、請求串行與本機 revision 保護競態；網路錯誤最多四次退避。GoogleAuth 新增 sub／email 識別，權杖不落盤。讀取錯誤、跨分頁、示範模式、正在編輯／來源同步及儲存失敗有保護。

Google Token 模式仍需有效授權；重新開網站／授權過期後可能要重新連接。預設 Client ID 仍為參考專案來源，必須以自己的專案允許正式／本機來源再做真實驗收；此草稿不能宣稱已實際同步。完整設定及限制見 docs/CLOUD_SYNC.md。只做語法與靜態差異檢查，未新增或執行測試，未讀寫使用者雲端資料。

---

# 2026-10-20：新增獨立遊戲名稱搜尋欄

基準 HEAD 376a977，main；開始時乾淨並與 origin/main 一致。使用者要求搜尋欄以直接尋找特定遊戲。

清單上方新增標記為 search 的搜尋區域，含可見 label、type=search 輸入及清除按鈕。app 在分頁前以 titleKey 正規化搜尋詞及 game.names／個人 titleAliases 做部分字串比對，包含數位原名、官方中英文名與獎盃名稱，忽略大小寫、全半形和商標符號；不做未保存的翻譯。與目前側欄分類、排除已分類開關取交集；切分類保留字詞，可從所有遊戲搜尋全庫。輸入與清除回第一頁，不重新建立搜尋欄，中文組字中略過 render 並於組字結束後更新。搜尋無結果顯示清除／切分類提示。

未恢復舊多選篩選區塊，未更動存檔、同步或腳本。僅做 JavaScript 語法、來源閱讀與 Git 差異檢查，未新增或執行測試；發布以 Actions／HTTP 確認。

---

# 2026-10-20：修正商標符號導致官方英文名稱配對失敗

基準 HEAD 9e4dacf，main；開始時乾淨並與 origin/main 一致。使用者提供兩張 PS5 卡片：數位庫「浪人崛起」官方名稱顯示 Rise of the RoninTM，PSNProfiles 為 Rise of the Ronin，未能合併。

原因在 store-names.js 的 cleanStoreTitle：先 normalize('NFKC') 再移除 ™，但 NFKC 已將 ™ 展開成普通 TM 字母，所以 titleMatch 無法匹配。調整為先移除商標符號，再做 NFKC，與 titleKey 的順序一致。依現有資料流程，官方名稱快取與匯入都保存 Sony 原文，officialNamesFor 每次 render 清理，因此重新整理即會重算，不需重新同步或更新腳本。未加入此遊戲的硬編碼別名，也未將任意 TM 字母刪除，避免破壞實際名稱。

仍遵守相同平台、區域與唯一候選規則，並保留來源獎盃 ID、進度和個人整理。僅做 JavaScript 語法與 Git 差異檢查，未新增或執行測試；未取得使用者當前存檔做實際配對驗收，發布以 Actions／HTTP 確認。

---

# 2026-10-20：尚未整理加入排除選項

基準 HEAD 4598c09，main；開始時乾淨並與 origin/main 一致。使用者要求「尚未整理」也有排除已分類選項。

沿用同一 checkbox，尚未整理預設勾選，取消後暫時顯示全庫已分類遊戲。app 在此檢視先使用 all 基礎清單，再依開關套用 catalogView(...,'unorganized')，避免取消勾選後仍被原本隱含條件限制。選取移除只在排除生效時執行，分類後即時離開清單的行為保留。兩組頁面內狀態分開：尚未整理預設 true，PS Plus／非 PS Plus 共用 false；切換分類保留各自狀態，重新整理回預設。其他分類不生效，存檔及備份 schema 不變。

僅做 JavaScript 語法、來源閱讀及 Git 差異檢查，未新增或執行測試。發布依 Actions／HTTP 確認。腳本維持 v0.3.1，不需重裝。

---

# 2026-10-20：分類統計顯示、PS Plus 整理選項與換頁回頂

基準 HEAD 849728b，main；開始時乾淨並與 origin/main 一致。實作使用者累積的三項調整。

全庫統計卡片只在 view=all 且沒有自訂 category 時顯示，其他側欄及自訂分類隱藏。PS Plus／非 PS Plus 的主清單新增一個預設未勾選的「排除已分類遊戲」checkbox，與原有尚未整理判斷共用 catalogView(...,'unorganized')，包含來源白金、所有非預設個人標記及自訂分類；筆記／標籤不影響。只在這兩個主清單顯示並生效，狀態在本頁記憶、重新整理重設，避免影響其他清單。開啟後隱藏的已分類卡片同步取消勾選，批次加入分類後也立即移除，避免對已完成項目再次操作。

上一頁／下一頁共用 changePage，重新繪製後 window.scrollTo 回到頁面頂端。未恢復舊篩選區塊，未改資料 schema、同步流程或 v0.3.1 腳本。

僅做 JavaScript 語法、來源閱讀與 Git 差異檢查，未新增或執行測試；發布依 Actions／HTTP 確認，未做瀏覽器操作驗收。

---

# 2026-10-20：暫時移除整個篩選區塊

基準 HEAD 46edddf，main；開始時乾淨並與遠端一致。使用者認為目前篩選太亂，要求先移除整塊，之後重新整理設計。

移除 index.html 的 filter-panel 與 app.js 的篩選模組 import、選項建立、條件比對、條件標籤、事件與 session 還原／保存。每次開啟從所有遊戲開始，僅按側欄檢視與自訂分類顯示，依名稱排列；舊 session 條件不會暗中繼續限制清單。空清單說明改為引導側欄導航。未重設或改寫遊戲存檔；原篩選模組與樣式暫留為未使用來源。

側欄、批次整理、個人分類、來源紀錄與同步保留。腳本仍為 v0.3.1，不需重裝。未加入替代篩選介面，等待使用者重新整理需求。

僅做 JavaScript 語法與 Git 差異檢查，未新增或執行測試。發布依 Actions／HTTP 確認，未做瀏覽器操作驗收。

---

# 2026-10-20：包含／排除兩區多選

基準 HEAD 1ebf082，main；開始時乾淨並與遠端一致。使用者將介面明確修正為「篩選 → 包含／排除，各可多選」，取代每個單選欄旁的排除勾選。

兩個原生 details 區塊各自呈現平台、完成狀態、來源、個人標記、自訂分類的多選 checkbox，以及獨立字詞與數字區間。包含同 facet 取 OR、不同 facet 取 AND；任一排除條件成立即排除，同項同時勾兩邊時排除優先。空包含不限制，空排除不隱藏。排序、整體折疊、區間清除與條件標籤沿用，新增每區清除。

catalog-filters.js 集中控制選項、讀取、比對、清除與還原。選項只在分類清單改變時重建，避免一般勾選／打字 render 造成焦點流失。只改 session 的篩選格式為 schemaVersion 2，同 key 並支援舊單選／排除／區間／分類遷移；遊戲備份與本機存檔 schema 不變。

sidebar 的分類仍為清單導航，與多選條件取交集；切換側欄保留包含／排除，清除全部會回 all 並重設。批次加入分類、個人筆記、來源資料與同步腳本不變（v0.3.1，不需重裝）。

只做 JavaScript 語法、靜態來源與 Git 差異檢查，未新增或執行測試。發布另依 Actions／HTTP 確認；真實瀏覽器操作未驗收。

---

# 2026-10-20：各篩選條件可反向排除

基準 HEAD 1d30210，main；開始時乾淨並與 origin/main 一致。使用者選擇「篩選條件反向」，不是獨立排除分類清單。

搜尋、平台、完成狀態、來源、個人整理、分類與完成率區間加入獨立排除 checkbox。只在該條件有值時取相反結果，再與其他篩選及側欄檢視取交集；無條件停用並清除旗標。排序不反向。自訂分類判斷移到 matchesCatalogFilters，避免 app 先套用正向條件。完整反向包含未符合原條件的未知進度，不把未知數值改成 0。

條件標籤、標題、清除單一／全部、完成率清除與 session 格式同步支援。舊「排除忽略」選項整併為選忽略＋排除，還原舊 session 時遷移，不改使用者資料；sidebar 點分類時恢復該分類正向導航。排除只影響清單，不刪遊戲、分類或筆記，也不影響同步與 v0.3.1 腳本。

只做語法與 Git 差異檢查，未新增或執行測試。發布另依 Actions 與線上 HTTP 確認。

---

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
