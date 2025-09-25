import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/adapter';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

const ADMIN_SECRET_KEY = 'admin-secret-key';

export async function GET(request: NextRequest) {
  try {
    // 檢查 API 金鑰
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '未授權的請求' }, { status: 401 });
    }

    // 初始化並獲取數據庫客戶端
    const db = await getDatabase(process.env.DB_PROVIDER);

    // 獲取所有 RFID 卡片以及對應的用戶信息
    const rfidCards = await db.$queryRaw`
      SELECT 
        rc.id, 
        rc.card_number, 
        rc.card_type, 
        rc.status, 
        rc.user_id,
        rc.issued_at, 
        rc.last_used_at, 
        rc.createdAt, 
        rc.updatedAt,
        u.email as user_email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM rfid_cards rc
      LEFT JOIN users u ON rc.user_id = u.uuid
      WHERE rc.status != 'DELETED'
      ORDER BY rc.createdAt DESC
    ` as any[];

    // 格式化卡片數據
    const cards = rfidCards.map((card: any) => ({
      id: Number(card.id), // 將 BigInt 轉換為 number
      card_number: card.card_number,
      card_type: card.card_type,
      status: card.status,
      user_id: card.user_id,
      user_email: card.user_email,
      user_name: card.user_name?.trim() || null,
      issued_at: card.issued_at,
      last_used_at: card.last_used_at,
      created_at: card.createdAt,
      updated_at: card.updatedAt
    }));

    return NextResponse.json({
      success: true,
      cards
    });

  } catch (error) {
    console.error('獲取卡片數據失敗:', error);
    return NextResponse.json(
      { error: '獲取卡片數據失敗' },
      { status: 500 }
    );
  }
}
