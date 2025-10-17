import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

// 強制動態渲染
export const dynamic = 'force-dynamic';

/**
 * 查詢充電樁狀態 API
 * 
 * 用途：查詢所有充電樁或特定充電樁的狀態資訊
 * 
 * 查詢參數：
 * - cpid: 充電樁 ID（選填）
 * - cpsn: 充電樁序號（選填）
 * - id: 充電樁資料庫 ID（選填）
 * 
 * @route GET /api/guns/status
 * @route GET /api/guns/status?cpid=xxx
 * @route GET /api/guns/status?cpsn=xxx
 * @route GET /api/guns/status?id=xxx
 * 
 * @returns { 
 *   success: boolean, 
 *   data: {
 *     id, cpid, cpsn, connector, 
 *     guns_status, acdc, max_kw, 
 *     guns_memo1, createdAt, updatedAt 
 *   } | Array,
 *   count?: number 
 * }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API /api/guns/status] 查詢充電樁狀態請求');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const cpid = searchParams.get('cpid');
    const cpsn = searchParams.get('cpsn');
    const id = searchParams.get('id');
    
    // 如果有提供 id，直接查詢單一充電樁
    if (id) {
      const numericId = Number(id);
      const gun = await databaseService.getGunById(isNaN(numericId) ? id : numericId);
      
      if (!gun) {
        console.log(`❌ [API /api/guns/status] Gun not found for id: ${id}`);
        return NextResponse.json(
          { success: false, error: '充電樁不存在' },
          { status: 404 }
        );
      }
      
      // 返回單一充電樁狀態
      const statusData = {
        id: gun.id,
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        guns_status: gun.guns_status,
        acdc: gun.acdc,
        max_kw: gun.max_kw,
        guns_memo1: gun.guns_memo1,
        transactionid: gun.transactionid,
        createdAt: gun.createdAt,
        updatedAt: gun.updatedAt
      };
      
      console.log(`✅ [API /api/guns/status] Found gun: ${gun.cpsn}, status: ${gun.guns_status}`);
      
      return NextResponse.json({
        success: true,
        data: statusData
      });
    }
    
    // 根據查詢參數建立過濾條件
    const filter: Record<string, any> = {};
    
    if (cpid) {
      filter.cpid = cpid;
      console.log(`🔍 [API /api/guns/status] Filtering by cpid: ${cpid}`);
    }
    
    if (cpsn) {
      filter.cpsn = cpsn;
      console.log(`🔍 [API /api/guns/status] Filtering by cpsn: ${cpsn}`);
    }
    
    // 查詢充電樁資料
    const guns = await databaseService.getGuns(filter);
    
    console.log(`✅ [API /api/guns/status] Found ${guns.length} guns`);
    
    // 轉換資料格式，只返回狀態相關的欄位
    const statusData = guns.map((gun: any) => ({
      id: gun.id,
      cpid: gun.cpid,
      cpsn: gun.cpsn,
      connector: gun.connector,
      guns_status: gun.guns_status,
      acdc: gun.acdc,
      max_kw: gun.max_kw,
      guns_memo1: gun.guns_memo1,
      transactionid: gun.transactionid,
      createdAt: gun.createdAt,
      updatedAt: gun.updatedAt
    }));
    
    // 如果有指定 cpid 或 cpsn，且只找到一筆，直接返回該物件
    if ((cpid || cpsn) && statusData.length === 1) {
      console.log(`✅ [API /api/guns/status] Returning single gun`);
      return NextResponse.json({
        success: true,
        data: statusData[0]
      });
    }
    
    // 返回陣列格式
    return NextResponse.json({
      success: true,
      data: statusData,
      count: statusData.length
    });
    
  } catch (error) {
    console.error('[API /api/guns/status] 錯誤:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '查詢充電樁狀態失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/guns/status - 查詢充電樁狀態 (支援 POST 請求)
 * 
 * 支援與 GET 相同的查詢方式：
 * - Query 參數：?cpid=xxx, ?cpsn=xxx, ?id=xxx
 * - Request Body (JSON)：{ cpid: "xxx", cpsn: "xxx", id: "xxx" }
 * 
 * Body 參數優先於 Query 參數
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [API /api/guns/status POST] 查詢充電樁狀態請求');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    let cpid = searchParams.get('cpid');
    let cpsn = searchParams.get('cpsn');
    let id = searchParams.get('id');
    
    // 嘗試解析 request body (優先使用 body)
    try {
      const body = await request.json();
      if (body) {
        cpid = body.cpid || cpid;
        cpsn = body.cpsn || cpsn;
        id = body.id || id;
      }
    } catch (err) {
      // Body 不是 JSON 或為空，使用 query 參數
      console.log('🔍 [API /api/guns/status POST] 使用 query 參數');
    }
    
    // 如果有提供 id，直接查詢單一充電樁
    if (id) {
      const numericId = Number(id);
      const gun = await databaseService.getGunById(isNaN(numericId) ? id : numericId);
      
      if (!gun) {
        console.log(`❌ [API /api/guns/status POST] Gun not found for id: ${id}`);
        return NextResponse.json(
          { success: false, error: '充電樁不存在' },
          { status: 404 }
        );
      }
      
      // 返回單一充電樁狀態
      const statusData = {
        id: gun.id,
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        guns_status: gun.guns_status,
        acdc: gun.acdc,
        max_kw: gun.max_kw,
        guns_memo1: gun.guns_memo1,
        transactionid: gun.transactionid,
        createdAt: gun.createdAt,
        updatedAt: gun.updatedAt
      };
      
      console.log(`✅ [API /api/guns/status POST] Found gun: ${gun.cpsn}, status: ${gun.guns_status}`);
      
      return NextResponse.json({
        success: true,
        data: statusData
      });
    }
    
    // 根據查詢參數建立過濾條件
    const filter: Record<string, any> = {};
    
    if (cpid) {
      filter.cpid = cpid;
      console.log(`🔍 [API /api/guns/status POST] Filtering by cpid: ${cpid}`);
    }
    
    if (cpsn) {
      filter.cpsn = cpsn;
      console.log(`🔍 [API /api/guns/status POST] Filtering by cpsn: ${cpsn}`);
    }
    
    // 查詢充電樁資料
    const guns = await databaseService.getGuns(filter);
    
    console.log(`✅ [API /api/guns/status POST] Found ${guns.length} guns`);
    
    // 轉換資料格式，只返回狀態相關的欄位
    const statusData = guns.map((gun: any) => ({
      id: gun.id,
      cpid: gun.cpid,
      cpsn: gun.cpsn,
      connector: gun.connector,
      guns_status: gun.guns_status,
      acdc: gun.acdc,
      max_kw: gun.max_kw,
      guns_memo1: gun.guns_memo1,
      transactionid: gun.transactionid,
      createdAt: gun.createdAt,
      updatedAt: gun.updatedAt
    }));
    
    // 如果有指定 cpid 或 cpsn，且只找到一筆，直接返回該物件
    if ((cpid || cpsn) && statusData.length === 1) {
      console.log(`✅ [API /api/guns/status POST] Returning single gun`);
      return NextResponse.json({
        success: true,
        data: statusData[0]
      });
    }
    
    // 返回陣列格式
    return NextResponse.json({
      success: true,
      data: statusData,
      count: statusData.length
    });
    
  } catch (error) {
    console.error('[API /api/guns/status POST] 錯誤:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '查詢充電樁狀態失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
