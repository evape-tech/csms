# EMS（能量管理系統）— 靜態（static）與動態（dynamic）

本文件說明 `src/servers/ocppController.js` 中 EMS 的決策與功率分配邏輯（中文）。

> 測試案例請參閱 `docs/EMS_TEST_CASES.md`。

## 概要
- EMS 會讀取 `siteSetting.ems_mode` 與 `siteSetting.max_power_kw`。
- 會蒐集所有充電槍（guns）以及線上／正在充電的子集（從 WebSocket 狀態與資料庫取得）。
- 每支槍有名義的 `max_kw` 與類型（AC / DC）。本系統中 AC 只有兩種規格：7 kW 或 11 kW；DC 目前僅使用 360 kW 規格。分配單位：AC → A（安培），DC → W（瓦特）。

## 共通步驟
1. 讀取 `siteSetting` 與 `max_power_kw`。
2. 取得所有槍並判別線上／正在充電：`onlineAcGuns`、`onlineDcGuns`、`chargingAcGuns`、`chargingDcGuns`。
3. 計算目標集合的總需求（sum of `gun.max_kw`）。
4. 依規則分配每支槍的功率，遵守最小值、單槍上限與全場 `max_power_kw`。
5. 為每個 `cpsn` 建構 OCPP SetChargingProfile 並在線上時透過 WebSocket 下發。

## 靜態模式（ems_mode = "static"）
- 原則：不論是否正在充電，對所有槍（全場）平均或按比例分配場域總功率。
- AC 處理：
  - totalAcDemand = 所有 AC 槍的 `max_kw` 加總。
  - 若 `totalAcDemand <= max_power_kw`：每支 AC 槍給予其規格功率（full spec）。
  - 否則：按比例縮放，ratio = `max_power_kw / totalAcDemand`，每支槍分配 `gun.max_kw * ratio`。
  - 分配後將 kW 轉成 A：`A = Math.floor((kw * 1000) / 220)`。
- DC 處理：
  - 先計算 AC 實際被分配的功率 actualAcPower = min(totalAcDemand, max_power_kw)。
  - 剩餘功率 availableDcPower = max_power_kw - actualAcPower。
  - 將剩餘功率於 DC 槍間平均分配，結果以 W 表示。

## 動態模式（ems_mode = "dynamic"）
- 原則：只對「正在充電」的槍優先分配；未充電的槍只給最小值或不分配。
- 若沒有任何槍正在充電，會退回到 static 的分配邏輯。
- 有充電中的槍時：
  - AC：只在 `chargingAcGuns` 間分配（非充電槍給最小 6A）。
    - 若 chargingAcGuns 的總需求 <= max_power_kw：給予規格值。
    - 否則按比例縮放（ratio = `max_power_kw / totalChargingAcDemand`）。
  - DC：計算可用給 DC 的功率 = `max_power_kw - actualChargingAcPower`，僅分配給 `chargingDcGuns`（平均分配）。
  - 非充電槍採最小值（AC：6A、DC：1000W）。

## 最小值與限制
- AC 最小值：6 A（若計算小於 6，強制設為 6A）。
- DC 最小值：1000 W（1 kW）。
- 對於高功率 AC（例如 11 kW 類型），有電流上限（例如 48 A）：若分配超過上限，會對電流做上限截斷並重新換算 kW。
- 不會分配負值或 0，皆會強制至少為最小值。

## 偵錯建議（建議加的 log）
- 在分配邏輯關鍵步驟加上輸出：
  - `totalAcDemand`、`totalChargingAcDemand`、`actualAcPower`、`availableDcPower`。
  - 每支槍的 `allocated_kw`、`unit`、`limit`（A 或 W）。
  - 哪些槍被判定為 `charging`、`online`。
- 若大量槍被設定為 6A，檢查 `isCharging` 判斷與資料庫中 `guns_status` 的實際值。
- 若分配超出預期，檢查 48A 上限與換算公式是否被正確套用。

---
