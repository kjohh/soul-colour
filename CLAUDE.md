# CLAUDE.md

給在這個 repo 工作的 Claude 的指引。

## 專案概述

「靈魂顏色偵測儀」——一個諷刺「靈魂顏色拍攝」的純前端惡搞網頁，部署於 GitHub Pages。
使用者拍照 → 食指按住能量球讀取 → 得到一張蓋上隨機極光漸層的拍立得可下載。
核心笑點：介面演得很認真，但**靈魂顏色完全是亂數**，與照片內容無關。

## 技術與原則

- 原生 HTML / CSS / JavaScript，**無框架、無打包步驟、無相依套件**。維持這個簡單性。
- 純靜態，直接放 repo 根目錄由 GitHub Pages 服務。
- **全程在裝置端運算，不上傳任何影像**（隱私是賣點，別破壞它）。
- 手機優先、直式。

## 設計原則（務必遵守）

- 簡潔、療癒、精緻，留白充足、動作輕柔。
- **不使用 emoji**。
- **不使用模板感卡片**（例如左側有色條 / ribbon 的卡片）。
- 深色、神秘、極光漸層的視覺基調。色盤：`#7dd3fc` `#c4b5fd` `#f9a8d4` `#5eead4` `#fcd7b6`。
- 中文標點與 serif（Noto Serif TC）用於標題，營造質感。

## 檔案結構

```
index.html    四個畫面：intro / camera / reading / result，以 data-screen 標記，JS 切換 .is-active
style.css     樣式與動畫（能量球極光、拍立得質感、付費視窗）
app.js        單一 IIFE，分區：畫面切換 / 相機 / 按壓讀取 / 隨機漸層 / 結果 / 下載合成 / 綁定
```

## 關鍵實作細節

- **按壓讀取**刻意不顯示進度（不讓使用者知道要按多久）。按住加 `.orb.is-holding`、`--p` 拉到 1，`setTimeout(DURATION)` 後完成；中途鬆開則歸零。
- **能量球極光**由 `.orb-glow`（呼吸光暈）、`.orb-wisp`（變形流體）、`.orb-wave ×3`（向外擴散波）疊出，皆用 `mix-blend-mode: screen`。
- **隨機漸層**：`makeGradient()` 隨機色相 + 角度，DOM 預覽與 canvas 下載共用同一組設定，保持一致。
- **拍立得下載**：`composePolaroid()` 用離螢幕 canvas 畫出投影、紙質顆粒、照片暗角、日期，再 `toBlob` 下載。
- **相機退路**：`getUserMedia` 失敗時顯示上傳照片，後續流程相同。
- **付費解鎖為惡搞**：不得加入任何真實金流或收集付款/憑證欄位。點解鎖只會顯示假的失敗訊息。

## 本機驗證

```bash
python3 -m http.server 8000   # 相機需 localhost 或 HTTPS
```
改動 UI 後，建議用瀏覽器實際走一遍流程（相機無法用時走上傳路徑）並截圖確認。
