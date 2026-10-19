import {emptyStoreNames,readStoreNames,mergeStoreNames,storeNameRequests} from './store-names.js';
export function initStoreNames({getState,setNames,save,render,isBlocked,isDemo}){
  const $=id=>document.getElementById(id),button=$('names-sync'),stop=$('names-stop'),status=$('names-status');
  const staticHosting=!['localhost','127.0.0.1'].includes(location.hostname);
  if(staticHosting){const count=Object.keys(getState().storeNames?.records||{}).length;status.textContent=(count?'已沿用 '+count+' 個官方名稱對照。':'')+'線上版可使用完整備份中的中英文對照；補齊 Sony 官方名稱需在本機版執行，再匯入完整備份。';button.disabled=true;button.title='請在本機版補齊名稱後匯入完整備份';return {auto(){}};}
  let busy=false,controller=null,generation=0,autoSignature='';
  function summary(){const data=getState().storeNames;const count=Object.keys(data?.records||{}).length;status.textContent=count?`已保存 ${count} 個 Sony 商品的官方名稱對照；同平台且唯一相符的遊玩紀錄會自動合併。`:'將以 Sony 商品 ID 批次補齊官方英文名稱，自動合併中英文紀錄。';}
  function writable(){if(isDemo())throw Error('請先離開示範模式。');if(isBlocked())throw Error('另一個分頁已有資料，請先重新整理。');}
  async function start({retryFailed=false,automatic=false}={}){
    if(busy)return;
    let products;try{writable();products=storeNameRequests(getState().library,getState().storeNames,{retryFailed});}catch(error){if(!automatic)status.textContent=error.message;return;}
    if(!products.length){if(!automatic)summary();return;}
    busy=true;button.disabled=true;stop.hidden=false;const run=++generation;let done=0,resolved=0,failed=0;
    try{
      controller=new AbortController();
      const health=await fetch('api/store-names',{cache:'no-store',credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});
      if(!health.ok||(await health.json()).ready!==true)throw Error('目前網站沒有啟動官方名稱查詢服務，請使用更新後的本機版。');
      for(let offset=0;offset<products.length;offset+=4){
        if(run!==generation)throw Error('已停止，已取得的名稱對照保留。');writable();
        status.textContent=`正在取得 Sony 官方英文名稱：${done} / ${products.length} 個商品；已取得 ${resolved}，尚未取得 ${failed}。可繼續瀏覽遊戲庫。`;
        const response=await fetch('api/store-names',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({products:products.slice(offset,offset+4)}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
        if(!response.ok)throw Error('官方名稱服務暫時無法回應，已完成的名稱對照保留。');
        const raw=await response.json();if(raw.schemaVersion!==1||!Array.isArray(raw.records)||!Array.isArray(raw.failures))throw Error('官方名稱服務回應格式不正確。');
        if(run!==generation)throw Error('已停止，已取得的名稱對照保留。');writable();
        const incoming=emptyStoreNames();
        for(const row of raw.records)incoming.records[row.productId]=row;
        for(const row of raw.failures)incoming.failures[row.productId]={error:row.error,checkedAt:new Date().toISOString()};
        const before=getState().storeNames,next=mergeStoreNames(before,readStoreNames(incoming));setNames(next);
        if(!save()){setNames(before);throw Error('儲存失敗，請先匯出備份。');}
        done+=products.slice(offset,offset+4).length;resolved+=raw.records.length;failed+=raw.failures.length;render();
        if(raw.failures.some(row=>row.error==='RATE_LIMITED'))throw Error('Sony 暫時限制查詢速度，已取得的對照保留，稍後可再補齊。');
      }
      status.textContent=`官方名稱補齊完成：取得 ${resolved} / ${products.length} 個商品對照，${failed} 個暫無資料。已依平台與唯一名稱自動合併；來源白金數不受卡片合併影響。`;
    }catch(error){status.textContent=controller?.signal.aborted||run!==generation?'已停止，已取得的名稱對照保留。':error.name==='TimeoutError'?'查詢逾時，已取得的名稱對照保留，可稍後再補齊。':error.message;}
    finally{busy=false;controller=null;button.disabled=false;stop.hidden=true;}
  }
  button.onclick=()=>start({retryFailed:true});stop.onclick=()=>{generation++;controller?.abort();};
  summary();
  return {auto(){const state=getState();if(busy||isDemo()||!state.library.games.length||!Object.keys(state.history?.sources||{}).length)return;const signature=[state.library.syncedAt,state.library.games.length,...Object.values(state.history.sources).map(source=>source.updatedAt)].join(':');if(signature===autoSignature)return;autoSignature=signature;void start({automatic:true});}};
}
