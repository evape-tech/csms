/**
 * 数据库仓库模块导出
 * 
 * 注意：PaymentRepository 和 InvoiceRepository 是 TypeScript 文件，
 * 主要用於 Next.js API routes，不包含在此 CommonJS index 中。
 * 如需使用，請直接從各自的文件引入：
 * - import { PaymentRepository } from '@/servers/repositories/paymentRepository'
 * - import { InvoiceRepository } from '@/servers/repositories/invoiceRepository'
 */

import * as chargePointRepository from './chargePointRepository.js';
import tariffRepository from './tariffRepository.js';
import billingRepository from './billingRepository.js'; // exports billingService instance

export { chargePointRepository, tariffRepository, billingRepository };
