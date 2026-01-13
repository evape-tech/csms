import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { OperationLogger } from '@/lib/operationLogger';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

const ADMIN_SECRET_KEY = 'admin-secret-key';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 檢查 API 金鑰
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '未授權的請求' }, { status: 401 });
    }

    const { id: cardId } = await params;
    const body = await request.json();
    const { card_number, card_type, status } = body;

    if (!card_number) {
      return NextResponse.json(
        { error: '缺少必要欄位：card_number' },
        { status: 400 }
      );
    }

    const db = getDatabaseClient();

    // 檢查卡片是否存在，同時取得 user_id（供日誌使用）
    const existingCard = await db.$queryRaw`
      SELECT id, user_id FROM rfid_cards WHERE id = ${Number(cardId)}
    ` as any[];

    if (!Array.isArray(existingCard) || existingCard.length === 0) {
      return NextResponse.json(
        { error: '卡片不存在' },
        { status: 404 }
      );
    }

    const user_id = existingCard[0].user_id ?? null;

    // 檢查卡片號碼是否被其他卡片使用
    const duplicateCard = await db.$queryRaw`
      SELECT id FROM rfid_cards WHERE card_number = ${card_number} AND id != ${Number(cardId)}
    ` as any[];

    if (Array.isArray(duplicateCard) && duplicateCard.length > 0) {
      return NextResponse.json(
        { error: '此卡片號碼已被其他卡片使用' },
        { status: 409 }
      );
    }

    // 更新卡片信息
    await db.$executeRaw`
      UPDATE rfid_cards 
      SET card_number = ${card_number},
          card_type = ${card_type},
          status = ${status},
          updatedAt = NOW()
      WHERE id = ${Number(cardId)}
    `;

    // 記錄成功操作日誌
    try {
      await OperationLogger.logCardOperation(
        'UPDATE',
        cardId,
        card_number,
        user_id ?? undefined,
        `成功更新RFID卡片: ${card_number} (類型: ${card_type}, 狀態: ${status})`,
        request
      );
    } catch (logErr) {
      console.warn('[API /api/cards] log UPDATE failed:', logErr);
    }

    return NextResponse.json(
      { message: '卡片更新成功' },
      { status: 200 }
    );

  } catch (error) {
    console.error('更新卡片失敗:', error);
    // 記錄失敗操作日誌（嘗試從 body 或 params 取得可用資訊）
    try {
      const body = await request.json().catch(() => ({}));
      const card_number = body?.card_number ?? '';
      const resolvedParams = params instanceof Promise ? await params : params;
      const cardIdStr = resolvedParams?.id ? String(resolvedParams.id) : '';
      await OperationLogger.logCardOperation(
        'UPDATE',
        cardIdStr,
        card_number,
        undefined,
        `更新RFID卡片失敗: ${error instanceof Error ? error.message : String(error)}`,
        request
      );
    } catch (logErr) {
      console.warn('[API /api/cards] log UPDATE failure log failed:', logErr);
    }

    return NextResponse.json(
      { error: '更新卡片失敗' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // 先解析 params（支援 Next 傳入 Promise 的情況）
    const resolvedParams = params instanceof Promise ? await params : params;

    // 檢查 API 金鑰
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '未授權的請求' }, { status: 401 });
    }

    const cardId = resolvedParams?.id;
    if (!cardId || isNaN(Number(cardId))) {
      return NextResponse.json({ error: '無效的卡片 ID' }, { status: 400 });
    }

    const db = getDatabaseClient();

    // 檢查卡片是否存在並取得資訊（用於日誌）
    const existingCard = await db.$queryRaw`
      SELECT card_number, user_id FROM rfid_cards WHERE id = ${Number(cardId)}
    ` as any[];

    if (!Array.isArray(existingCard) || existingCard.length === 0) {
      return NextResponse.json({ error: '卡片不存在' }, { status: 404 });
    }

    const card_number = existingCard[0].card_number ?? null;
    const user_id = existingCard[0].user_id ?? null;

    // 執行刪除
    await db.$executeRaw`
      DELETE FROM rfid_cards WHERE id = ${Number(cardId)}
    `;

    // 記錄成功操作日誌
    try {
      await OperationLogger.logCardOperation(
        'DELETE',
        cardId,
        card_number ?? '',
        user_id ?? undefined,
        `成功刪除RFID卡片: ${card_number}`,
        request
      );
    } catch (logErr) {
      console.warn('[API /api/cards] log DELETE failed:', logErr);
    }

    return NextResponse.json({ message: '卡片刪除成功' }, { status: 200 });

  } catch (error) {
    console.error('刪除卡片失敗:', error);
    // 嘗試記錄失敗日誌
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const cardIdStr = resolvedParams?.id ? String(resolvedParams.id) : '';
      await OperationLogger.logCardOperation(
        'DELETE',
        cardIdStr,
        '',
        undefined,
        `刪除RFID卡片失敗: ${error instanceof Error ? error.message : String(error)}`,
        request
      );
    } catch (logErr) {
      console.warn('[API /api/cards] log DELETE failure log failed:', logErr);
    }

    return NextResponse.json({ error: '刪除卡片失敗' }, { status: 500 });
  }
}
