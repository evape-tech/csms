import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database/service';
import { OperationLogger } from '@/lib/operationLogger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 記錄嘗試的 user 資訊供失敗時使用
  let attemptedUserId: string | number | null = null;
  let attemptedUserEmail: string | null = null;

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

    attemptedUserId = userId ?? null;
    attemptedUserEmail = body?.email ?? null;

    // 若前端沒有提供 email，嘗試從 databaseService 撈出 user 的 email（容錯）
    if (!attemptedUserEmail && attemptedUserId && databaseService) {
      try {
        const getById = typeof (databaseService as any).getUserById === 'function';
        const getGeneric = typeof (databaseService as any).getUser === 'function';
        const getByEmailFn = typeof (databaseService as any).getUserByEmail === 'function';
        let userRecord = null;
        if (getById) {
          userRecord = await (databaseService as any).getUserById(attemptedUserId);
        } else if (getGeneric) {
          userRecord = await (databaseService as any).getUser(attemptedUserId);
        } else if (getByEmailFn && attemptedUserEmail) {
          userRecord = await (databaseService as any).getUserByEmail(attemptedUserEmail);
        }
        if (userRecord && userRecord.email) attemptedUserEmail = String(userRecord.email);
      } catch (e) {
        console.warn('[reset-password] failed to lookup user email by id', e);
      }
    }

    // 若提供 email 但沒有 userId，嘗試用 email 查出 userId（容錯）
    if (!attemptedUserId && attemptedUserEmail && databaseService) {
      try {
        if (typeof (databaseService as any).getUserByEmail === 'function') {
          const userRecord = await (databaseService as any).getUserByEmail(attemptedUserEmail);
          if (userRecord && userRecord.id) attemptedUserId = userRecord.id;
        }
      } catch (e) {
        console.warn('[reset-password] failed to lookup user id by email', e);
      }
    }

    if (!userId || !newPassword) {
      return NextResponse.json({ success: false, error: 'Missing userId or newPassword' }, { status: 400 });
    }

    // 嘗試 hash 密碼（開發環境若沒安裝 bcryptjs 會直接存明文）
    const toUpdate: any = {};
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

      // 記錄失敗日誌
      try {
        await OperationLogger.logUserOperation(
          'UPDATE',
          String(attemptedUserId ?? attemptedUserEmail ?? 'unknown'),
          attemptedUserEmail ?? String(attemptedUserId ?? 'unknown'),
          '重設密碼失敗: Database update method not available'
        );
      } catch (logErr) {
        console.warn('[reset-password] log failure failed:', logErr);
      }

      return NextResponse.json({ success: false, error: 'Database update method not available' }, { status: 501 });
    }

    // 記錄成功操作日誌
    try {
      await OperationLogger.logUserOperation(
        'UPDATE',
        String(attemptedUserId ?? attemptedUserEmail ?? 'unknown'),
        attemptedUserEmail ?? String(attemptedUserId ?? 'unknown'),
        `重設密碼成功 (userEmail=${attemptedUserEmail},userId=${attemptedUserId})`
      );
    } catch (logErr) {
      console.warn('[reset-password] log success failed:', logErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /api/users/reset-password] error:', err);
    const message = err instanceof Error ? err.message : String(err);

    // 記錄失敗日誌（保守處理）
    try {
      await OperationLogger.logUserOperation(
        'UPDATE',
        String(attemptedUserId ?? attemptedUserEmail ?? 'unknown'),
        attemptedUserEmail ?? String(attemptedUserId ?? 'unknown'),
        `重設密碼失敗: ${message}`
      );
    } catch (logErr) {
      console.warn('[reset-password] log failure failed:', logErr);
    }

    return NextResponse.json({ success: false, error: 'Internal', message }, { status: 500 });
  }
}