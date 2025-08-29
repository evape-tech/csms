@echo off
echo 🔧 Generating Prisma clients for both databases...

REM 生成 MySQL 客戶端
echo 📊 Generating MySQL client...
npx prisma generate --schema=prisma/schema.prisma

REM 生成 MSSQL 客戶端
echo 📊 Generating MSSQL client...
npx prisma generate --schema=prisma/schema.mssql.prisma

echo ✅ All Prisma clients generated successfully!
echo.
echo Client locations:
echo   MySQL:  prisma-clients/mysql/
echo   MSSQL:  prisma-clients/mssql/

pause
