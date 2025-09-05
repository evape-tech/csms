/**
 * OCPP控制器修改示例
 * 
 * 这个文件展示了如何在不大幅改动ocppController.js的情况下集成MQ功能
 * 注意：这只是一个示例文件，不要直接使用
 */

// 添加MQ连接器引用
const ocppMqConnector = require('./services/ocppMqConnector');

// 示例1：在StartTransaction处理中添加MQ事件发布
if(j_aa[2]=="StartTransaction"){
  console.log('into "StartTransaction" proc')
  //[2,"fdb09c01-ba68-7ac4-5f05-8687dfa317d9","StartTransaction",{"connectorId":1,"idTag":"wang1234","meterStart":0,"timestamp":"2024-01-23T14:44:08.001Z"}]
  //expiryDate=taipei time + 24h
  var thisconnector=j_aa[3].connectorId
  console.log('start_connectorid:'+thisconnector)
  if(thisconnector==1){
    trans_id=1111;
    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
    wsCpdatas[req.params.id][0].connector_1_meter.charging_start_time = now_time
    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
    
    // 添加MQ事件发布 - 充电开始
    const cpid = getCpidFromWsData(id, thisconnector);
    if (cpid) {
      ocppMqConnector.publishChargingStarted(id, cpid, thisconnector, trans_id);
    }
  }
  if(thisconnector==2){
    trans_id=2222;
    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
    wsCpdatas[req.params.id][0].connector_2_meter.charging_start_time = now_time
    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
    
    // 添加MQ事件发布 - 充电开始
    const cpid = getCpidFromWsData(id, thisconnector);
    if (cpid) {
      ocppMqConnector.publishChargingStarted(id, cpid, thisconnector, trans_id);
    }
  }
  
  // 其余代码保持不变
  // ...
}

// 示例2：在StopTransaction处理中添加MQ事件发布
if(j_aa[2]=="StopTransaction"){
  console.log('into "StopTransaction" proc')
  if(j_aa[3].transactionId==1111){
    update_guns_status(id,1,"Finishing");
    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
    wsCpdatas[req.params.id][0].connector_1_meter.charging_stop_time = now_time
    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
    
    // 添加MQ事件发布 - 充电结束
    const cpid = getCpidFromWsData(id, 1);
    if (cpid) {
      ocppMqConnector.publishChargingStopped(id, cpid, 1, j_aa[3].transactionId, j_aa[3].meterStop);
    }
  }
  if(j_aa[3].transactionId==2222){
    update_guns_status(id,2,"Finishing");
    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
    wsCpdatas[req.params.id][0].connector_2_meter.charging_start_time = now_time
    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
    
    // 添加MQ事件发布 - 充电结束
    const cpid = getCpidFromWsData(id, 2);
    if (cpid) {
      ocppMqConnector.publishChargingStopped(id, cpid, 2, j_aa[3].transactionId, j_aa[3].meterStop);
    }
  }
  
  // 其余代码保持不变
  // ...
}

// 示例3：在状态变更中添加MQ事件发布
async function update_guns_status(gun_cpsn, gun_connector, gun_status){
  console.log("into update_guns_status()");
  const { databaseService: dbService } = await loadDatabaseModules();
  const guns = await dbService.getGuns({ cpsn: gun_cpsn, connector: String(gun_connector) });
  const gun_cpid = guns.length > 0 ? guns[0] : null;

  if(gun_cpid !== null){
    console.log("before status ="+gun_cpid.guns_status+"new is="+gun_status);
    
    // 记录旧状态用于MQ事件
    const oldStatus = gun_cpid.guns_status;

    await dbService.updateGun(gun_cpid.id, {
      guns_status: gun_status,
      updatedAt: new Date()
    });
    
    // 添加MQ事件发布 - 状态变更
    ocppMqConnector.publishStatusChanged(gun_cpsn, gun_cpid.cpid, gun_connector, oldStatus, gun_status);
    
    await send_cp_to_kw_api(gun_cpid.cpid,gun_status,gun_cpid.guns_metervalue1,gun_cpid.guns_metervalue2,gun_cpid.guns_metervalue3,gun_cpid.guns_metervalue4,gun_cpid.guns_metervalue5,gun_cpid.guns_metervalue6)
  }
  else{
    console.log("gun_cpid not find == null!!!!!");
  }

  return 0;
}

// 示例4：在MeterValues处理中添加MQ事件发布
if(j_aa[2]=="MeterValues"){
  // 现有代码
  console.log('into "MeterValues" proc');
  var meter_connectorid=j_aa[3].connectorId;
  var meter_transactionid= j_aa[3].transactionId;
  
  // 省略部分代码...
  
  // 在更新计量值后添加MQ事件发布
  update_guns_meters(req.params.id, meter_connectorid, cp_data1, cp_data2, cp_data3, cp_data4);
  
  // 添加MQ事件发布 - 计量值更新
  const cpid = getCpidFromWsData(id, meter_connectorid);
  if (cpid) {
    const meterValues = {
      energy: cp_data1,
      current: cp_data2,
      voltage: cp_data3,
      power: cp_data4,
      transactionId: meter_transactionid
    };
    
    ocppMqConnector.publishMeterValues(id, cpid, meter_connectorid, meterValues);
  }
  
  // 其余代码保持不变
  // ...
}

// 示例5：修改全站功率重新分配函数，添加MQ事件发布
async function scheduleGlobalPowerReallocation(eventType, eventDetails = {}, immediate = false) {
  const reallocationId = `${eventType}_${Date.now()}`;
  console.log(`[全站重分配] 🌐 开始全站功率重新分配 (ID: ${reallocationId})`);
  
  // 添加MQ事件发布 - 全站重新分配
  ocppMqConnector.publishGlobalReallocation(eventType, {
    ...eventDetails,
    reallocationId,
    immediate
  });
  
  // 原有代码保持不变
  // ...
}

// 示例6：修改功率配置更新函数，添加MQ事件发布
async function ocpp_send_command(cpid, cmd, payload) {
  // 现有代码...
  
  if(cmd=="ocpp_set_charging_profile"){
    // 处理功率配置更新
    
    // 添加MQ事件发布 - 功率配置更新
    ocppMqConnector.publishProfileUpdate(cpid, {
      siteSetting: payload.siteSetting,
      limit,
      unit,
      connector: parseInt(gun.connector)
    });
    
    // 其余代码保持不变
    // ...
  }
}
