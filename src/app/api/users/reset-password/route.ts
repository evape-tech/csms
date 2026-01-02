import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (databaseService && typeof (databaseService as any).initialize === 'function') {
      await (databaseService as any).initialize(process.env.DB_PROVIDER);
    } else {
      // DatabaseUtils not available; skip initialization
    }
    const apiKey = (req.headers.get('x-api-key') || '').trim();
    const allowedKey = process.env.ADMIN_API_KEY || 'admin-secret-key';
    if (!apiKey || apiKey !== allowedKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = body?.userId ?? body?.id;
    const newPassword = body?.newPassword ?? body?.password;

    if (!userId || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing userId or newPassword' }, { status: 400 });
    }

    // 嘗試 hash 密碼（開發環境若沒安裝 bcryptjs 會直接存明文）
    let toUpdate: any = {};
    try {
      // 如果尚未安裝： npm install bcryptjs
      const bcrypt = require('bcryptjs');
      toUpdate.password = await bcrypt.hash(String(newPassword), 10);
    } catch (_) {
      toUpdate.password = String(newPassword);
    }

    // 優先使用 databaseService 的 updateUser / update
    if (databaseService && typeof (databaseService as any).updateUser === 'function') {
      await (databaseService as any).updateUser(userId, toUpdate);
    } else if (databaseService && typeof (databaseService as any).update === 'function') {
      await (databaseService as any).update('users', userId, toUpdate);
    } else {
      console.error('[reset-password] no update method on databaseService');
      return NextResponse.json({ success: false, error: 'Database update method not available' }, { status: 501 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /api/users/reset-password] error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: 'Internal', message }, { status: 500 });
  }
}