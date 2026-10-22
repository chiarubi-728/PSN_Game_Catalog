function request(type,payload={}, {signal,timeout=90000}={}){
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID();let timer;
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',cancel);}
    function cancel(){cleanup();window.postMessage({type:'PSGB_CATALOG_CANCEL',requestId},location.origin);reject(Error('已停止名稱查詢，已保存的資料保留。'));}
    // Privileged extension replies can have source=null. Keep the exact page
    // origin, reply type and unpredictable request ID checks in both cases.
    function receive(event){if((event.source!==window&&event.source!==null)||event.origin!==location.origin||event.data?.type!=='PSGB_CATALOG_REPLY'||event.data.requestId!==requestId)return;cleanup();event.data.error?reject(Error('官方名稱查詢未完成，請稍後重試。')):resolve(event.data.payload);}
    if(signal?.aborted)return cancel();
    window.addEventListener('message',receive);signal?.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>{cleanup();window.postMessage({type:'PSGB_CATALOG_CANCEL',requestId},location.origin);reject(Object.assign(Error('尚未偵測到同步腳本，請先完成安裝或檢查執行權限。'),{code:'script-unavailable'}));},timeout);
    window.postMessage({type,requestId,...payload},location.origin);
  });
}
export const pingScript=options=>request('PSGB_CATALOG_PING',{}, {timeout:2500,...options});
export const lookupStoreNames=(products,options)=>request('PSGB_CATALOG_NAMES',{products},options);
