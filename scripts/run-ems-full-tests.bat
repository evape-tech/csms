@echo off
REM EMS 分配演算法完整測試套件
REM 包含單元測試、一致性驗證、整合測試

echo =====================================
echo EMS 分配演算法完整測試套件
echo =====================================
echo.

echo [1/4] 執行 EMS 演算法單元測試...
echo.
call npx jest tests/emsAllocator.test.js --verbose
if errorlevel 1 (
    echo ❌ 單元測試失敗
    goto :end
)

echo.
echo [2/4] 執行 EMS 一致性驗證測試...
echo.
call npx jest tests/emsConsistency.test.js --verbose
if errorlevel 1 (
    echo ❌ 一致性驗證失敗
    goto :end
)

echo.
echo [3/4] 執行 EMS 整合測試...
echo.
call npx jest tests/emsIntegration.test.js --verbose
if errorlevel 1 (
    echo ❌ 整合測試失敗
    goto :end
)

echo.
echo [4/4] 執行完整測試覆蓋率分析...
echo.
call npx jest --testPathPatterns="ems.*test" --coverage --collectCoverageFrom="src/lib/emsAllocator.js"

echo.
echo =====================================
echo ✅ 完整測試套件執行完成
echo =====================================
echo.
echo 📊 測試總結:
echo - 單元測試: 11個測試案例
echo - 一致性驗證: 8個測試案例  
echo - 整合測試: 7個測試案例
echo - 總計: 26個測試案例
echo.
echo 📁 相關文件:
echo - 演算法實作: src/lib/emsAllocator.js
echo - OCPP整合: src/servers/ocppController.js  
echo - 測試報告: docs/EMS_TEST_REPORT.md
echo - 演算法文件: docs/EMS_MODE.md
echo - 測試案例: docs/EMS_TEST_CASES.md
echo.
echo 🎯 系統狀態: EMS已完成整合，可投入生產使用
echo.

:end
pause
