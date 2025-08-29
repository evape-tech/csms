import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../lib/database/utils.js';
import { databaseManager } from '../../../lib/database/adapter.js';

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
        if (!provider || !['mysql', 'mssql'].includes(provider)) {
          return NextResponse.json(
            { error: 'Invalid provider. Must be mysql or mssql' },
            { status: 400 }
          );
        }

        const switched = await DatabaseUtils.switchDatabase(provider);
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
          const result = await DatabaseUtils.testConnection(provider);
          return NextResponse.json({
            provider,
            connected: result
          });
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
