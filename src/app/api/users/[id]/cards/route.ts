import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { AuthUtils } from '@/lib/auth/auth';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 驗證管理員權限
    let currentUser;
    try {
      currentUser = await AuthUtils.getCurrentUser(request);
    } catch (error) {
      throw error;
    }

    if (!currentUser || !AuthUtils.isAdmin(currentUser)) {
      return NextResponse.json({ 
        error: '未授權訪問', 
        code: 'AUTHENTICATION_REQUIRED',
        message: '請重新登入以獲取有效的認證憑證'
      }, { status: 401 });
    }

    const { id } = await params;
    const db = getDatabaseClient();

    // 獲取用戶的 RFID 卡片（排除已刪除的卡片）
    const rfidCards = await db.$queryRaw`
      SELECT id, card_number, card_type, status, issued_at, last_used_at, createdAt, updatedAt
      FROM rfid_cards 
      WHERE user_id = ${id} AND status != 'DELETED'
      ORDER BY createdAt DESC
    ` as any[];

    // 格式化卡片數據
    const cards = rfidCards.map((card: any) => ({
      id: Number(card.id), // 將 BigInt 轉換為 number
      card_number: card.card_number,
      card_type: card.card_type,
      status: card.status,
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
    console.error('獲取用戶卡片失敗:', error);
    return NextResponse.json(
      { error: '獲取用戶卡片失敗' },
      { status: 500 }
    );
  }
}
