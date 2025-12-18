"use server";

import DatabaseUtils from '../lib/database/utils.js';
import { databaseService } from '../lib/database/service.js';

/**
 * Server action to fetch active charging standards.
 */
export async function getChargingStandards() {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const standards = await databaseService.getChargingStandards({ is_active: true });
    return { success: true, data: standards };
  } catch (error) {
    console.error('[ServerAction] getChargingStandards error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
