#!/bin/bash

echo "🔧 Generating Prisma client for MySQL..."

echo "📊 Generating MySQL client..."
npx prisma generate --schema=prisma/schema.prisma

echo "✅ Prisma client generated successfully!"
echo "Client location: prisma-clients/mysql/"
