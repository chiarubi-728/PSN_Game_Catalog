// The extension mailbox survives Sony login redirects and COOP isolation.
function command(type,replyType,{session,...payload},{signal,timeout=5000}={}){
  return new Promise((resolve,reject)=>{
    let timer;
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',cancel);}
    function cancel(){cleanup();reject(Object.assign(Error('已停止同步。'),{code:'cancelled'}));}
    function receive(event){
      if(event.origin!==location.origin||(event.source!==window&&event.source!==null)||event.data?.type!==replyType||event.data.session!==session)return;
      cleanup();event.data.available===false||event.data.error?reject(Object.assign(Error(event.data.error||'同步通道尚未就緒，請更新腳本並重新整理主頁。'),{code:'script-unavailable'})):resolve(event.data);
    }
    if(signal?.aborted){cancel();return;}
    window.addEventListener('message',receive);signal?.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>{cleanup();reject(Object.assign(Error('尚未收到同步腳本回應，請檢查安裝與執行權限。'),{code:'script-unavailable'}));},timeout);
    window.postMessage({type,session,...payload},location.origin);
  });
}
export const prepareSonyRelay=(session,profile,options)=>command('PSGB_SONY_RELAY_START','PSGB_SONY_RELAY_READY',{session,profile},options);
export const navigateSonyRelay=(session,url,options)=>command('PSGB_SONY_RELAY_NEXT','PSGB_SONY_RELAY_MOVED',{session,url},options);
export const stopSonyRelay=(session,saved=false)=>window.postMessage({type:'PSGB_SONY_RELAY_STOP',session,saved},location.origin);
