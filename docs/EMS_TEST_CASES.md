# EMS 測試案例

本檔案收錄針對 `src/servers/ocppController.js` EMS 演算法的測試案例（假定、目的、計算、預期）。

使用說明：每個案例包含「假定條件」（樁數、每樁名義功率、場域 max_power_kw）、簡短模擬計算與預期結果，方便手動或自動化測試。

---

- Case 1 — 靜態（容量足夠）
  - 用意：驗證 static 模式在容量充足時不會縮減槍的規格。
  - 假定：ems_mode=static、max_power_kw=50、3 台 AC，max_kw=[7,7,7]（總需求 21 kW）。
  - 計算：21 <= 50 -> 每台給予原始值。A = floor(7000/220)=31A → [31A,31A,31A]。
  - 預期：下發 [31A,31A,31A]，不套用最小值或截斷。

- Case 2 — 靜態（超載，比例縮放）
  - 用意：驗證超載時按比例縮放並正確換算 kW → A。
  - 假定：ems_mode=static、max_power_kw=10、3 台 AC 各 7kW（total=21kW）。
  - 計算：ratio = 10/21 ≈ 0.47619；allocated_kw ≈ 3.333kW；A = floor(3333/220) = 15A（每台）。
  - 預期：每台下發約 15A（若分配 <6A 則會補 6A，但此例 >6A）。

- Case 3 — 動態（無槍在充電，回退 static）
  - 用意：確認 dynamic 在無充電活動時退回 static 行為。
  - 假定：ems_mode=dynamic，場域同 Case1，但所有槍均非 charging。
  - 預期：回退 static，分配結果與 Case1 相同（[31A,31A,31A]），並在 log 記錄回退訊息。

- Case 4 — 動態（部分槍在充電，需求 <= max）
  - 用意：驗證僅為 charging 槍分配資源，非 charging 給最小值。
  - 假定：ems_mode=dynamic、max_power_kw=20、4 台 AC（均為 7kW），其中 2 台 charging（charging total = 14 kW）。
  - 預期：2 台 charging 各給 full spec = 7kW → A=31A；其餘非 charging 給 6A；allocated = [31A,31A,6A,6A]。

- Case 5 — 動態（charging 過載，charging 間比例分配）
  - 用意：驗證在 charging 過載時只在 charging 集合內按比例分配。
  - 假定：ems_mode=dynamic、max_power_kw=10、3 台 AC（7kW），2 台 charging 各 7kW（charging total = 14 kW）。
  - 預期：ratio = 10/14 ≈ 0.7143；allocated_kw_per_charging ≈ 5.0 kW → A = floor(5000/220) = 22A；非 charging = 6A。

- Case 6 — DC 分配（AC 優先，DC 取剩餘）
  - 用意：驗證 DC 以 W 單位取剩餘功率並平均分配。
  - 假定：ems_mode=static、max_power_kw=1080 kW、3 台 DC 各 360 kW（AC 無）。
  - 計算：availableDcPower = 1080 kW → per DC = 1080/3 = 360 kW = 360000 W。
  - 預期：每台下發約 360000W（若系統要求至少 1000W，則滿足）。

- Case 7 — 11kW AC 上限截斷
  - 用意：確認對 11 kW AC（系統上限 48A）有正確截斷與換算。
  - 假定：單台 11 kW AC；計算原始 A = floor(11000/220) = 50A，但系統上限為 48A。
  - 預期：實際下發 48A，換算回 kw ≈ 10.56 kW，log 顯示已套用上限。

---

驗證重點：檢查 log 中的 `totalAcDemand`、`totalChargingAcDemand`、`actualAcPower`、`availableDcPower`、各槍 `allocated_kw`/`unit`/`limit`，以及 notifyOcpp 的 per-cp 發送 summary。

---

## 執行測試步驟（快速指南）

以下範例以 PowerShell 為主；腳本位置：`scripts/run-ems-tests.js`。

先決條件：
- Node 18+（需要 global `fetch`）。
- 本地服務啟動順序建議：資料庫 → OCPP 伺服器 → Next.js（確保 `src/servers/ocppController.js` 與 Next API 可見日誌）。

環境變數說明：
- `API_HOST`：目標 Next API 主機（預設 `http://localhost:3000`）。
- `API_PATH`：API 路徑（預設 `/api/site_setting`）。
- `DELAY_MS`：每個 case 間隔毫秒（預設 600）。若充電樁反應慢可調大，例如 3000。
- `CASES`：CSV 指定要執行的 case id（與命令列參數二擇一）。

基本範例（PowerShell）：

- 單一 case（例如 case 1） :
  ```powershell
  $env:API_HOST="http://localhost:3000"; node .\scripts\run-ems-tests.js 1
  ```

- 多個 case（命令列參數） :
  ```powershell
  node .\scripts\run-ems-tests.js 2 4 5
  ```

- 使用環境變數 `CASES`（CSV） :
  ```powershell
  $env:API_HOST="http://localhost:3000"; $env:CASES="3,5"; node .\scripts\run-ems-tests.js
  ```

- 延長間隔（例如 3 秒） :
  ```powershell
  $env:API_HOST="http://localhost:3000"; $env:DELAY_MS="3000"; node .\scripts\run-ems-tests.js 1 2
  ```

行為說明：
- 未指定 case 時，會依文件內所有案例逐一執行；若指定 case 則只執行指定項目，順序以輸入為準。
- 腳本會輸出每個 case 的 HTTP 回應與 body，並於最後列出 summary。若有任何 case 失敗，腳本會以非零狀態碼結束。

故障排除（快速）：
- 若出現 `global fetch is not available`：請升級 Node 至 18+ 或改用 fetch polyfill（較簡單：升級 Node）。
- 若 HTTP 回傳 404/400：確認 `API_HOST`/`API_PATH` 與 Next.js 路由是否一致，並檢查 Next API 日誌。
- 若 ocpp server 回傳 400 且訊息為 `cpid undefined`：確認 `src/app/api/site_setting/route.ts` 的 notifyOcpp 是否已改為 per-CP 發送（本專案預設已改）。
- 若充電樁無反應：請檢查 OCPP 伺服器日誌，適當增大 `DELAY_MS` 或以單 case 手動驗證。

欲進一步自動化選項：
- 我可以幫你將此腳本加入 `package.json` 的 script（例如 `run-ems-tests`），或改為互動模式（每 case 等你按 Enter），或加入簡易的 poll 檢查 ocppController 是否已下發命令。指出要哪一項我再幫你修改即可。
