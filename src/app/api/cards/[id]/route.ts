import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';

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

    // 檢查卡片是否存在
    const existingCard = await db.$queryRaw`
      SELECT id FROM rfid_cards WHERE id = ${Number(cardId)}
    ` as any[];

    if (!Array.isArray(existingCard) || existingCard.length === 0) {
      return NextResponse.json(
        { error: '卡片不存在' },
        { status: 404 }
      );
    }

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

    return NextResponse.json(
      { message: '卡片更新成功' },
      { status: 200 }
    );

  } catch (error) {
    console.error('更新卡片失敗:', error);
    return NextResponse.json(
      { error: '更新卡片失敗' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const db = getDatabaseClient();

    // 檢查卡片是否存在
    const existingCard = await db.$queryRaw`
      SELECT id FROM rfid_cards WHERE id = ${Number(cardId)}
    ` as any[];

    if (!Array.isArray(existingCard) || existingCard.length === 0) {
      return NextResponse.json(
        { error: '卡片不存在' },
        { status: 404 }
      );
    }

    // 軟刪除卡片（將狀態設為 DELETED）
    await db.$executeRaw`
      UPDATE rfid_cards 
      SET status = 'DELETED',
          updatedAt = NOW()
      WHERE id = ${Number(cardId)}
    `;

    return NextResponse.json(
      { message: '卡片刪除成功' },
      { status: 200 }
    );

  } catch (error) {
    console.error('刪除卡片失敗:', error);
    return NextResponse.json(
      { error: '刪除卡片失敗' },
      { status: 500 }
    );
  }
}
