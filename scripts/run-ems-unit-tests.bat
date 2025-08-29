@echo off
REM EMS 分配演算法測試執行腳本
REM 使用方式: run-ems-unit-tests.bat

echo =====================================
echo EMS 分配演算法單元測試
echo =====================================
echo.

echo [1/3] 執行單元測試...
call npx jest tests/emsAllocator.test.js --verbose

echo.
echo [2/3] 執行覆蓋率分析...
call npx jest tests/emsAllocator.test.js --coverage --collectCoverageFrom="src/lib/emsAllocator.js"

echo.
echo [3/3] 測試完成
echo 測試報告: docs/EMS_TEST_REPORT.md
echo 測試案例: docs/EMS_TEST_CASES.md  
echo 演算法文件: docs/EMS_MODE.md
echo.
pause
