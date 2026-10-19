import {emptyStoreNames,readStoreNames,mergeStoreNames,storeNameRequests} from './store-names.js';
import {pingScript,lookupStoreNames} from './script-bridge.js';
export function initStoreNames({getState,setNames,save,render,isBlocked,isDemo}){
  const $=id=>document.getElementById(id),button=$('names-sync'),stop=$('names-stop'),status=$('names-status');
  let job=null,controller=null,autoSignature='',available=false;
  function summary(){const count=Object.keys(getState().storeNames?.records||{}).length;status.textContent=count?'已保存 '+count+' 個官方名稱對照，會依平台自動合併中英文遊戲。':'同步時會由整合腳本自動補齊 Sony 官方中英文名稱。';}
  function writable(){if(isDemo())throw Error('請先離開示範模式。');if(isBlocked())throw Error('另一分頁已有資料，請先重新整理。');}
  async function run({retryFailed=false,onStatus}={}){
    let done=0,resolved=0,failed=0;
    const say=text=>{status.textContent=text;onStatus?.(text);};
    try{
      writable();const products=storeNameRequests(getState().library,getState().storeNames,{retryFailed});
      if(!products.length){summary();return {complete:true,resolved:0,failed:0};}
      controller=new AbortController();button.disabled=true;stop.hidden=false;
      const ready=await pingScript({signal:controller.signal});if(!ready?.onlineNames)throw Error('請先更新整合腳本至 v0.3.1，再重新整理此網站。');available=true;
      for(let offset=0;offset<products.length;offset+=4){
        writable();if(controller.signal.aborted)throw Error('已停止名稱查詢。');
        say('正在補齊官方名稱：'+done+' / '+products.length+'，已取得 '+resolved+'，暫無資料 '+failed+'。');
        const batch=products.slice(offset,offset+4),raw=await lookupStoreNames(batch,{signal:controller.signal});
        if(raw?.schemaVersion!==1||!Array.isArray(raw.records)||!Array.isArray(raw.failures))throw Error('官方名稱回應格式不正確。');
        const requested=new Set(batch.map(item=>item.productId));
        if([...raw.records,...raw.failures].some(row=>!requested.has(row.productId)))throw Error('官方名稱回應不是本批商品。');
        writable();if(controller.signal.aborted)throw Error('已停止名稱查詢。');
        const incoming=emptyStoreNames();for(const row of raw.records)incoming.records[row.productId]=row;for(const row of raw.failures)incoming.failures[row.productId]={error:row.error,checkedAt:new Date().toISOString()};
        const before=getState().storeNames,next=mergeStoreNames(before,readStoreNames(incoming));setNames(next);
        if(!save()){setNames(before);throw Error('名稱對照儲存失敗，請先匯出備份。');}
        done+=raw.records.length+raw.failures.length;resolved+=raw.records.length;failed+=raw.failures.length;render();
        if(raw.failures.some(row=>row.error==='RATE_LIMITED'))throw Error('Sony 暫時限制查詢，已取得的對照保留，可稍後重試。');
      }
      say('官方名稱已補齊：本次取得 '+resolved+' 個對照，'+failed+' 個商品暫無資料；原有遊戲紀錄全部保留。');
      return {complete:true,resolved,failed};
    }catch(error){say(error.message);return {complete:false,resolved,failed,error:error.message};}
    finally{controller=null;button.disabled=false;stop.hidden=true;}
  }
  function start(options){if(job)return job;job=run(options).finally(()=>{job=null;});return job;}
  function cancel(){controller?.abort();}
  button.onclick=()=>start({retryFailed:true});stop.onclick=cancel;summary();
  pingScript().then(info=>{available=info?.onlineNames===true;}).catch(()=>{});
  return {start,cancel,auto(){const state=getState();if(job||!available||isDemo()||!state.library.games.length||!Object.keys(state.history?.sources||{}).length)return;const signature=[state.library.syncedAt,state.library.games.length,...Object.values(state.history.sources).map(source=>source.updatedAt)].join(':');if(signature===autoSignature)return;autoSignature=signature;void start();}};
}
