'use server';

import { PrismaClient } from '../../../../../prisma-clients/mysql';
import { NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth/auth';
import { OperationLogger } from '@/lib/operationLogger';

const prisma = new PrismaClient();

// 簡單的認證檢查函數
async function checkAuth(request) {
  const user = await AuthUtils.getCurrentUser(request);
  if (!user || !AuthUtils.isAdmin(user)) {
    return null;
  }
  return {
    user: {
      uuid: user.userId, // 使用 UUID 作為用戶識別符
      userId: user.userId, // 保持 userId 字段以向後兼容
      role: user.role,
      email: user.email
    }
  };
}

export async function GET(request) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const channels = await prisma.billing_channels.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: channels
    });
  } catch (error) {
    console.error('Error fetching billing channels:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing channels'
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, status = 1, config } = body;

    // 驗證必填字段
    if (!name || !code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name and code are required'
        },
        { status: 400 }
      );
    }

    // 檢查 code 是否已存在
    const existingChannel = await prisma.billing_channels.findUnique({
      where: { code }
    });

    if (existingChannel) {
      return NextResponse.json(
        {
          success: false,
          error: 'Code already exists'
        },
        { status: 400 }
      );
    }

    const newChannel = await prisma.billing_channels.create({
      data: {
        name,
        code,
        status,
        config
      }
    });

    // 記錄操作日誌
    await OperationLogger.log({
      actionType: 'CREATE',
      entityType: 'PAYMENT_CHANNEL',
      entityId: newChannel.id.toString(),
      entityName: name,
      description: `創建支付通道: ${name} (代碼: ${code})`
    }, request);

    return NextResponse.json({
      success: true,
      data: newChannel
    });
  } catch (error) {
    console.error('Error creating billing channel:', error);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'CREATE',
        entityType: 'PAYMENT_CHANNEL',
        description: `創建支付通道失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create billing channel'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, code, status, config } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID is required'
        },
        { status: 400 }
      );
    }

    // 先獲取原始記錄用於日誌
    const originalChannel = await prisma.billing_channels.findUnique({
      where: { id }
    });

    // 檢查是否嘗試修改 code 且 code 已存在於其他記錄
    if (code) {
      const existingChannel = await prisma.billing_channels.findFirst({
        where: {
          code,
          id: { not: id }
        }
      });

      if (existingChannel) {
        return NextResponse.json(
          {
            success: false,
            error: 'Code already exists'
          },
          { status: 400 }
        );
      }
    }

    const updatedChannel = await prisma.billing_channels.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(status !== undefined && { status }),
        ...(config !== undefined && { config })
      }
    });

    // 記錄操作日誌
    await OperationLogger.log({
      actionType: 'UPDATE',
      entityType: 'PAYMENT_CHANNEL',
      entityId: id.toString(),
      entityName: updatedChannel.name,
      description: `更新支付通道: ${updatedChannel.name}`
    }, request);

    return NextResponse.json({
      success: true,
      data: updatedChannel
    });
  } catch (error) {
    console.error('Error updating billing channel:', error);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'UPDATE',
        entityType: 'PAYMENT_CHANNEL',
        description: `更新支付通道失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update billing channel'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID is required'
        },
        { status: 400 }
      );
    }

    // 先獲取記錄用於日誌
    const channel = await prisma.billing_channels.findUnique({
      where: { id: parseInt(id) }
    });

    await prisma.billing_channels.delete({
      where: { id: parseInt(id) }
    });

    // 記錄操作日誌
    await OperationLogger.log({
      actionType: 'DELETE',
      entityType: 'PAYMENT_CHANNEL',
      entityId: id,
      entityName: channel?.name || `支付通道#${id}`,
      description: `刪除支付通道: ${channel?.name || id}`
    }, request);

    return NextResponse.json({
      success: true,
      message: 'Billing channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting billing channel:', error);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'DELETE',
        entityType: 'PAYMENT_CHANNEL',
        description: `刪除支付通道失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete billing channel'
      },
      { status: 500 }
    );
  }
}
