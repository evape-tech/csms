import { PrismaClient } from '../../../../../prisma-clients/mysql';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET() {
  try {
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

    return NextResponse.json({
      success: true,
      data: newChannel
    });
  } catch (error) {
    console.error('Error creating billing channel:', error);
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

    return NextResponse.json({
      success: true,
      data: updatedChannel
    });
  } catch (error) {
    console.error('Error updating billing channel:', error);
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

    await prisma.billing_channels.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({
      success: true,
      message: 'Billing channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting billing channel:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete billing channel'
      },
      { status: 500 }
    );
  }
}
