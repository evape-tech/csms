import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { OperationLogger } from '@/lib/operationLogger';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

const ADMIN_SECRET_KEY = 'admin-secret-key';

export async function POST(request: NextRequest) {
  try {
    // 檢查 API 金鑰
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '未授權的請求' }, { status: 401 });
    }

    const body = await request.json();
    const { card_number, card_type = 'RFID', status = 'ACTIVE', user_id } = body;

    if (!card_number || !user_id) {
      // 記錄失敗操作
      await OperationLogger.log({
        actionType: 'CREATE',
        entityType: 'RFID_CARD',
        entityName: card_number || 'unknown',
        description: `新增RFID卡片失敗: 缺少必要欄位 (card_number: ${card_number}, user_id: ${user_id})`,
        status: 'FAILED'
      }, request);

      return NextResponse.json(
        { error: '缺少必要欄位：card_number 和 user_id' },
        { status: 400 }
      );
    }

    const db = getDatabaseClient();

    // 檢查卡片號碼是否已存在
    const existingCard = await db.$queryRaw`
      SELECT id FROM rfid_cards WHERE card_number = ${card_number}
    `;

    if (Array.isArray(existingCard) && existingCard.length > 0) {
      // 記錄失敗操作
      await OperationLogger.logCardOperation(
        'CREATE',
        'duplicate',
        card_number,
        user_id,
        `新增RFID卡片失敗: 卡片號碼已存在`,
        request
      );

      return NextResponse.json(
        { error: '此卡片號碼已被使用' },
        { status: 409 }
      );
    }

    // 新增 RFID 卡片
    await db.$executeRaw`
      INSERT INTO rfid_cards (
        card_number, 
        card_type, 
        status, 
        user_id, 
        issued_at, 
        createdAt, 
        updatedAt
      )
      VALUES (
        ${card_number}, 
        ${card_type}, 
        ${status}, 
        ${user_id}, 
        NOW(), 
        NOW(), 
        NOW()
      )
    `;

    // 獲取剛創建的卡片 ID
    const newCardResult = await db.$queryRaw`
      SELECT id FROM rfid_cards WHERE card_number = ${card_number}
    `;
    
    const cardId = Array.isArray(newCardResult) && newCardResult.length > 0 
      ? (newCardResult[0] as any).id.toString() 
      : 'unknown';

    // 記錄成功操作
    await OperationLogger.logCardOperation(
      'CREATE',
      cardId,
      card_number,
      user_id,
      `成功新增RFID卡片: ${card_number} (類型: ${card_type}, 狀態: ${status})`,
      request
    );

    return NextResponse.json(
      { message: '卡片新增成功', cardId },
      { status: 201 }
    );

  } catch (error) {
    console.error('新增卡片失敗:', error);
    
    // 記錄錯誤日誌
    const { card_number, user_id } = await request.json().catch(() => ({}));
    await OperationLogger.log({
      actionType: 'CREATE',
      entityType: 'RFID_CARD',
      entityName: card_number || 'unknown',
      description: `新增RFID卡片失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      status: 'FAILED'
    }, request);
    
    return NextResponse.json(
      { error: '新增卡片失敗' },
      { status: 500 }
    );
  }
}
