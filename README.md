# PSN Game Catalog

個人的 PlayStation 遊戲整理工具，整合 Sony 數位授權與 PSNProfiles 遊玩、獎盃紀錄，保留自己的分類、標籤與筆記。

**[開啟遊戲庫](https://chiarubi-728.github.io/PSN_Game_Catalog/)** · [應用程式介紹](https://chiarubi-728.github.io/PSN_Game_Catalog/about.html) · [安裝整合腳本](https://chiarubi-728.github.io/PSN_Game_Catalog/scripts/ps-game-base.user.js)

## 開始使用

1. 在 Chrome／Edge 安裝 [Tampermonkey](https://www.tampermonkey.net/)，再安裝本專案的整合腳本 **v0.3.8**。無痕模式需另外允許擴充功能執行。
2. 安裝完成後，回到遊戲庫主頁重新整理。若停在安裝提示，按第 3 步「已完成安裝，重新整理主頁」。
3. 按右上角「同步遊戲庫」，首次填入自己的 **PSN Online ID**。
4. 在 Sony 分頁完成登入，核對面板帳號並勾選確認。系統依序更新數位授權、遊玩與獎盃、官方中英文名稱；三步完成並保存後自動收起進度視窗。

日常使用直接開啟網站，不需安裝 Node.js 或啟動本機服務。已有完整 JSON 備份時，也可從「資料管理」匯入。

## 主要功能

- **整合遊戲庫**：數位授權與遊玩紀錄合併呈現，同一作品不同平台分開整理。
- **搜尋與篩選**：支援中英文名稱、PS5／PS4／PS3／PS Vita、分類及獎盃完成率；平台與標記可循環「選取 → 排除 → 取消」。
- **個人整理**：白金、追蹤、忽略、自訂分類、標籤與私人筆記；卡片可直接操作。
- **日期排序**：依遊戲名稱、取得／領取順序或最後獲得獎盃時間排序。
- **即時結果數**：清單前顯示符合目前搜尋及篩選的遊戲總數。
- **保存與備份**：資料先存於瀏覽器，可匯出完整 JSON；選用 Google Drive 雲端同步。

## 資料來源與限制

| 來源 | 用途 | 限制 |
| --- | --- | --- |
| Sony 官方遊戲庫 | PS4／PS5 數位授權、PS Plus 標示、取得順序 | 不代表付款紀錄、目前訂閱或全部實體收藏；確切日期可能缺漏 |
| PSNProfiles | 遊玩清單、平台、獎盃、白金及獲獎日期 | 依公開資料及來源更新狀態；獎盃紀錄不能證明仍持有實體片 |
| Sony 公開商店 | 官方中英文名稱及商品對照 | 下架、區域差異或無法唯一對應時，保留獨立項目 |

Sony 登入與來源網站驗證需自行完成。腳本只帶入預期帳號，實際 Sony 登入身分仍由使用者核對；讀取失敗時會保留已保存的階段，供重試。

## 保存你的資料

遊戲庫、分類及筆記預設保存在目前瀏覽器。清除網站資料或結束無痕工作階段前，請匯出完整備份，或確認雲端已同步。

Google 登入用於自己的 Drive 備份空間，與 PSN 登入分開；兩端資料都有修改時，會暫停並請你選擇版本。詳細行為及自架設定見 [雲端同步說明](docs/CLOUD_SYNC.md)。GitHub 儲存庫不保存使用者的私人遊戲庫。

[隱私權政策](https://chiarubi-728.github.io/PSN_Game_Catalog/privacy.html) · [服務說明](https://chiarubi-728.github.io/PSN_Game_Catalog/terms.html)

## 文件與開發

[文件目錄](docs/README.md) · [完整使用說明](docs/使用說明.md) · [維護指南](docs/MAINTENANCE.md) · [目前交接狀態](docs/HANDOFF.md)

原生 HTML／CSS／ES modules，無第三方套件或建置步驟。本機開發使用 Node.js 20+：

```sh
npm start
```

預覽網址為 `http://127.0.0.1:4175`。`dist/` 是網站原始碼與發布內容；推送 `main` 後，由 GitHub Actions 發布至 GitHub Pages。

## 來源與致謝

本專案基於 [promise82114/ps-game-base](https://github.com/promise82114/ps-game-base) 延伸。整合腳本內保留所使用程式碼的授權與來源標示，見 [腳本授權](dist/scripts/LICENSE)。
