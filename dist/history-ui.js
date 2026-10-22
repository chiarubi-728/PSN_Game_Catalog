import {historyProfile,historySnapshot,mergeHistory,readHistory} from './history.js';
import {assertCatalogAccount} from './model.js';
export function initHistorySync({getState,setHistory,save,render,notice,isDemo,isBlocked}){
  const $=id=>document.getElementById(id),dialog=$('history-dialog');
  let pending=null,bridge=null,timer;
  const say=text=>{$('history-status').textContent=text;bridge?.onStatus?.(text);};
  function writable(){if(isDemo())throw Error('請先離開示範模式。');if(isBlocked())throw Error('請先處理資料保存提示。');if(getState().library.games.length&&!getState().library.account)throw Error('原有數位庫尚未確認帳號，請先按「同步遊戲庫」完成帳號設定。');}
  function summary(){
    const history=getState().history,sources=Object.values(history?.sources||{});
    $('history-summary').textContent=sources.length?sources.map(source=>`${source.provider==='psnprofiles'?'PSNProfiles':'Sony'}：${source.games.length} 筆，白金 ${source.games.filter(game=>game.platinum).length}、尚未白金 ${source.games.filter(game=>!game.platinum).length}${source.coverage==='platinum'?'（舊白金資料，尚非完整遊玩清單）':''}，${new Date(source.updatedAt).toLocaleString('zh-TW')}`).join('\n'):'尚未同步遊玩紀錄。原本的數位遊戲庫會保留。';
    $('history-export').disabled=!sources.length;
    if(history?.profile)$('history-profile').value=history.profile;
  }
  function open(){summary();if(!dialog.open)dialog.showModal();}
  function release(current,saved=false){if(current)window.postMessage({type:'PSGB_HISTORY_RELAY_STOP',session:current.session,saved},location.origin);}
  function stop(keepRelay=false){const current=bridge;bridge=null;clearTimeout(timer);current?.cancelPrepare?.();if(!keepRelay)release(current);$('history-fetch').disabled=false;}
  function prepareRelay(current){
    return new Promise((resolve,reject)=>{
      let wait;
      function cleanup(){clearTimeout(wait);window.removeEventListener('message',ready);current.cancelPrepare=null;}
      function ready(event){
        // Extension replies may have a null source; origin and the fresh run
        // session still have to match. Cross-site source messages stay strict.
        if((event.source!==window&&event.source!==null)||event.origin!==location.origin||event.data?.type!=='PSGB_HISTORY_RELAY_READY'||event.data.session!==current.session)return;
        cleanup();event.data.available?resolve():reject(Error('跨分頁同步尚未就緒。請更新整合腳本至 v0.3.6、同意新增權限，並重新整理遊戲庫後再同步。'));
      }
      current.cancelPrepare=()=>{cleanup();reject(Error('已停止等待來源分頁。'));};
      window.addEventListener('message',ready);
      wait=setTimeout(()=>{cleanup();reject(Error('遊戲庫主頁未收到跨分頁通道回應。請確認 Tampermonkey 允許 PSN Game Catalog 在此頁執行，並重新整理主頁。'));},3000);
      window.postMessage({type:'PSGB_HISTORY_RELAY_START',session:current.session,profile:current.profile,knownDates:(getState().history?.sources?.psnprofiles?.games||[]).filter(game=>game.lastTrophyAt).map(game=>({id:game.id,date:game.lastTrophyAt}))},location.origin);
    });
  }
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function commit(snapshot){
    writable();const previous=getState().history,next=mergeHistory(previous,snapshot);setHistory(next);
    if(!save()){setHistory(previous);throw Error('儲存失敗，遊玩紀錄未寫入。');}
    render();summary();
    const text=`已匯入 ${snapshot.games.length} 筆${snapshot.provider==='psnprofiles'?' PSNProfiles':' Sony'}遊玩紀錄，包含 ${snapshot.games.filter(game=>game.platinum).length} 筆白金。所有紀錄已加入主清單。${snapshot.coverage==='platinum'?'這份是舊白金資料；請使用 v0.3.6 整合腳本同步完整清單。':''}`;
    say(text);notice(text);pending=null;$('history-account-confirm').hidden=true;
  }
  function receive(raw,expected){
    writable();const snapshot=historySnapshot(raw,expected);assertCatalogAccount(getState(),snapshot.profile);
    if(raw.kind?.startsWith('ps-game-base-sony-')&&raw.profile?.verified!==true){pending=snapshot;$('history-account-confirm').hidden=false;$('history-account-confirm').textContent=`確認這份 Sony 資料來自 ${snapshot.profile}，匯入遊玩紀錄`;say('Sony 未提供可驗證帳號，請確認資料帳號後匯入。');return false;}
    commit(snapshot);return true;
  }
  for(const id of ['platinum-open','platinum-settings','sony-open','sony-settings'])if($(id))$(id).onclick=open;
  function start({child:existingChild,onComplete,onError,onStatus,profile:requestedProfile}={}){
    let started=false;
    try{
      writable();if(bridge)throw Error('正在等待來源分頁，請先完成同步或停止等待。');
      const profile=historyProfile(requestedProfile||$('history-profile').value),session=crypto.randomUUID(),url=new URL('https://psnprofiles.com/'+profile);
      assertCatalogAccount(getState(),profile);
      if(getState().history?.profile&&getState().history.profile.toLowerCase()!==profile.toLowerCase())throw Error('目前遊玩紀錄屬於不同帳號，請確認帳號後再同步。');
      url.hash=new URLSearchParams({psgbOrigin:location.origin,psgbSession:session,psgbHistory:'1'}).toString();
      const child=existingChild&&!existingChild.closed?existingChild:window.open('about:blank','_blank');if(!child)throw Error('請允許開啟同步分頁。');
      const current={kind:'psnprofiles',child,session,profile,origin:url.origin,onComplete,onError,onStatus,relay:false};bridge=current;$('history-fetch').disabled=true;
      started=true;
      say('正在準備遊玩紀錄的跨分頁回報通道…');
      timer=setTimeout(()=>{const current=bridge;stop();const text='等候遊玩紀錄逾時，已保存的資料保留。請確認整合腳本已更新並完成網站驗證，再重試。';say(text);current?.onError?.(Error(text));},1200000);
      // Register the mailbox before navigation. COOP may sever the old WindowProxy
      // and window.opener, but the userscript can still return this run's history.
      void prepareRelay(current).then(()=>{
        if(bridge!==current)return;
        current.relay=true;child.location.href=url.href;
        say('請在來源分頁完成 PSNProfiles 驗證；整合腳本會自動讀取全部遊戲。');
      }).catch(error=>{
        if(bridge!==current)return;
        stop();say(error.message);if(onError)onError(error);else notice(error.message);
      });
      return child;
    }catch(error){if(started)stop();say(error.message);if(onError)onError(error);else notice(error.message);return null;}
  }
  $('history-fetch').onclick=()=>start();
  window.addEventListener('message',event=>{
    if(!bridge)return;
    const relayed=event.origin===location.origin&&(event.source===window||event.source===null)&&event.data?.type==='PSGB_HISTORY_RELAY_MESSAGE'&&event.data.sourceOrigin===bridge.origin;
    if(relayed&&!bridge.relay)return;
    if(!relayed&&(event.origin!==bridge.origin||event.source!==bridge.child))return;
    const data=relayed?event.data.message:event.data;
    if(data?.session!==bridge.session||relayed&&event.data.session!==bridge.session)return;
    if(data.type==='PSGB_HISTORY_ERROR'){const current=bridge;stop();const error=Error(String(data.message||'遊玩紀錄讀取失敗，請查看來源分頁。').slice(0,500));say(error.message);current.onError?.(error);return;}
    if(['PSGB_HISTORY_STATUS','PSGB_PLATINUM_STATUS','PSGB_SONY_STATUS'].includes(data.type))say(String(data.message||'').slice(0,500));
    if(['PSGB_HISTORY_RESULT','PSGB_PLATINUM_RESULT','PSGB_SONY_RESULT'].includes(data.type)){
      const current=bridge;stop(true);let saved=false;try{
        if(historySnapshot(data.payload,current.profile).provider!==current.kind)throw Error('回傳的資料來源與本次同步不同。');
        if(current.onComplete&&(!data.payload?.complete||historySnapshot(data.payload,current.profile).coverage!=='all'))throw Error('整合同步僅接受完整遊玩清單。');
        if(receive(data.payload,current.profile)){
          saved=true;
          if(relayed)window.postMessage({type:'PSGB_HISTORY_RELAY_ACK',session:current.session},location.origin);
          else event.source.postMessage({type:'PSGB_HISTORY_SAVED',session:current.session},event.origin);
          current.onComplete?.(historySnapshot(data.payload,current.profile));
        }
      }catch(error){say(error.message);current.onError?.(error);}finally{release(current,saved);}if(!current.onComplete)open();
    }
  });
  function cancel(){const current=bridge;stop();say('已停止等待回傳。');current?.onError?.(Error('已停止同步；已保存的資料保留。'));}
  $('history-cancel').onclick=cancel;
  $('history-import').onclick=()=>$('history-file').click();
  $('history-file').onchange=async()=>{
    try{
      writable();const file=$('history-file').files[0];if(!file)return;if(file.size>15*1024*1024)throw Error('遊玩紀錄 JSON 上限 15 MB。');
      const raw=JSON.parse(await file.text());
      if(raw.kind==='ps-game-base-history'){
        const imported=readHistory(raw);assertCatalogAccount(getState(),imported.profile);for(const snapshot of Object.values(imported.sources))historySnapshot(snapshot,historyProfile($('history-profile').value));
        // Commit the container once, so a failure cannot leave a half import.
        const previous=getState().history;let next=previous;for(const snapshot of Object.values(imported.sources))next=mergeHistory(next,snapshot);
        setHistory(next);if(!save()){setHistory(previous);throw Error('儲存失敗，遊玩紀錄未寫入。');}render();summary();say('已匯入全部遊玩來源，紀錄已加入主清單。');
      }else receive(raw,historyProfile($('history-profile').value));
    }catch(error){say(error.message);}finally{$('history-file').value='';}
  };
  $('history-account-confirm').onclick=()=>{try{if(pending)commit(pending);}catch(error){say(error.message);}};
  $('history-export').onclick=()=>download({kind:'ps-game-base-history',...getState().history},'ps-game-base-history-'+new Date().toISOString().slice(0,10)+'.json');
  summary();
  return {start,cancel,open,get busy(){return !!bridge;}};
}
