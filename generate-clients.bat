@echo off
echo 🔧 Generating Prisma client for MySQL...

REM 生成 MySQL 客戶端
echo 📊 Generating MySQL client...
npx prisma generate --schema=prisma/schema.prisma

echo ✅ Prisma client generated successfully!
echo.
echo Client location:
echo   MySQL:  prisma-clients/mysql/

pause
