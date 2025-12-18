import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../lib/database/utils.js';
import { databaseManager } from '../../../lib/database/adapter.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await DatabaseUtils.getDatabaseStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json(
      { error: 'Failed to get database stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, provider } = body;

    switch (action) {
      case 'switch':
        if (!provider || provider !== 'mysql') {
          return NextResponse.json(
            { error: "Invalid provider. Only 'mysql' is supported" },
            { status: 400 }
          );
        }

        const switched = await DatabaseUtils.switchDatabase('mysql');
        if (switched) {
          return NextResponse.json({
            success: true,
            message: `Switched to ${provider.toUpperCase()}`,
            currentProvider: databaseManager.getProvider()
          });
        } else {
          return NextResponse.json(
            { error: `Failed to switch to ${provider}` },
            { status: 500 }
          );
        }

      case 'test':
        if (provider) {
          if (provider !== 'mysql') {
            return NextResponse.json({ error: "Only 'mysql' is supported" }, { status: 400 });
          }
          const result = await DatabaseUtils.testConnection('mysql');
          return NextResponse.json({ provider: 'mysql', connected: result });
        } else {
          const results = await DatabaseUtils.testAllConnections();
          return NextResponse.json(results);
        }

      case 'healthCheck':
        const isHealthy = await DatabaseUtils.healthCheck();
        return NextResponse.json({
          healthy: isHealthy,
          provider: databaseManager.getProvider()
        });

      case 'initialize':
        const initialized = await DatabaseUtils.initialize(provider);
        return NextResponse.json({
          success: initialized,
          provider: databaseManager.getProvider()
        });

      case 'disconnect':
        await DatabaseUtils.gracefulShutdown();
        return NextResponse.json({
          success: true,
          message: 'Database disconnected'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Database API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
