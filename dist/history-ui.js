import {historyProfile,historySnapshot,mergeHistory,readHistory} from './history.js';
import {sonyRequest} from './sony-platinums.js';
export function initHistorySync({getState,setHistory,save,render,notice,isDemo,isBlocked}){
  const $=id=>document.getElementById(id),dialog=$('history-dialog');
  let pending=null,bridge=null,timer;
  const say=text=>{$('history-status').textContent=text;};
  function writable(){if(isDemo())throw Error('請先離開示範模式。');if(isBlocked())throw Error('另一分頁已有新資料，請先重新整理。');}
  function summary(){
    const history=getState().history,sources=Object.values(history?.sources||{});
    $('history-summary').textContent=sources.length?sources.map(source=>`${source.provider==='psnprofiles'?'PSNProfiles':'Sony'}：${source.games.length} 筆，白金 ${source.games.filter(game=>game.platinum).length}、尚未白金 ${source.games.filter(game=>!game.platinum).length}${source.coverage==='platinum'?'（舊白金資料，尚非完整遊玩清單）':''}，${new Date(source.updatedAt).toLocaleString('zh-TW')}`).join('\n'):'尚未同步遊玩紀錄。原本的數位遊戲庫會保留。';
    $('history-export').disabled=!sources.length;
    if(history?.profile)$('history-profile').value=history.profile;
  }
  function open(){summary();if(!dialog.open)dialog.showModal();}
  function stop(){clearTimeout(timer);bridge=null;$('history-fetch').disabled=false;$('history-sony-start').disabled=false;}
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function commit(snapshot){
    writable();const previous=getState().history,next=mergeHistory(previous,snapshot);setHistory(next);
    if(!save()){setHistory(previous);throw Error('儲存失敗，遊玩紀錄未寫入。');}
    render();summary();
    const text=`已匯入 ${snapshot.games.length} 筆${snapshot.provider==='psnprofiles'?' PSNProfiles':' Sony'}遊玩紀錄，包含 ${snapshot.games.filter(game=>game.platinum).length} 筆白金。所有紀錄已加入主清單。${snapshot.coverage==='platinum'?'這份是舊白金資料；請更新 PSNProfiles 腳本至 0.2.3 後同步完整清單。':''}`;
    say(text);notice(text);pending=null;$('history-account-confirm').hidden=true;
  }
  function receive(raw,expected){
    writable();const snapshot=historySnapshot(raw,expected);
    if(raw.kind?.startsWith('ps-game-base-sony-')&&raw.profile?.verified!==true){pending=snapshot;$('history-account-confirm').hidden=false;$('history-account-confirm').textContent=`確認這份 Sony 資料來自 ${snapshot.profile}，匯入遊玩紀錄`;say('Sony 未提供可驗證帳號，請確認資料帳號後匯入。');return false;}
    commit(snapshot);return true;
  }
  for(const id of ['platinum-open','platinum-settings','sony-open','sony-settings'])$(id).onclick=open;
  $('history-fetch').onclick=()=>{
    try{
      writable();if(bridge)throw Error('正在等待來源分頁，請先完成同步或停止等待。');
      const profile=historyProfile($('history-profile').value),session=crypto.randomUUID(),url=new URL('https://psnprofiles.com/'+profile);
      url.hash=new URLSearchParams({psgbOrigin:location.origin,psgbSession:session,psgbHistory:'1'}).toString();
      const child=window.open(url.href,'_blank');if(!child)throw Error('請允許開啟 PSNProfiles 分頁。');
      bridge={kind:'psnprofiles',child,session,profile,origin:url.origin};$('history-fetch').disabled=true;
      say('請在 PSNProfiles 分頁完成網站安全驗證。v0.2.3 腳本會自動展開完整遊戲清單並傳回；不需逐款配對。');
      timer=setTimeout(()=>{stop();say('已停止等待。來源頁讀取完成後，仍可匯出遊玩紀錄 JSON 再匯入。');},1200000);
    }catch(error){say(error.message);}
  };
  $('history-sony-start').onclick=()=>{
    try{
      writable();if(bridge)throw Error('正在等待來源分頁，請先完成同步或停止等待。');
      const request=sonyRequest(getState().library,historyProfile($('history-profile').value)),session=crypto.randomUUID(),url=new URL('https://library.playstation.com/recently-purchased');
      url.hash=new URLSearchParams({psgbSonyOrigin:location.origin,psgbSonySession:session}).toString();
      const child=window.open(url.href,'_blank');if(!child)throw Error('請允許開啟 Sony 官方分頁。');
      bridge={kind:'sony',child,session,profile:request.expectedProfile,origin:url.origin,request};$('history-sony-start').disabled=true;
      say('請在官方分頁助手面板按「開始整批比對」。Sony 結果用來補充 ID 對應；完整遊玩清單請同步 PSNProfiles。');
      timer=setTimeout(()=>{stop();say('已停止等待 Sony，仍可匯入助手匯出的結果 JSON。');},1200000);
    }catch(error){say(error.message);}
  };
  window.addEventListener('message',event=>{
    if(!bridge||event.origin!==bridge.origin||event.source!==bridge.child||event.data?.session!==bridge.session)return;
    const data=event.data;
    if(data.type==='PSGB_SONY_READY'&&bridge.kind==='sony')bridge.child.postMessage({type:'PSGB_SONY_REQUEST',session:bridge.session,request:bridge.request},bridge.origin);
    if(['PSGB_HISTORY_STATUS','PSGB_PLATINUM_STATUS','PSGB_SONY_STATUS'].includes(data.type))say(String(data.message||'').slice(0,500));
    if(['PSGB_HISTORY_RESULT','PSGB_PLATINUM_RESULT','PSGB_SONY_RESULT'].includes(data.type)){
      const current=bridge;stop();try{
        if(historySnapshot(data.payload,current.profile).provider!==current.kind)throw Error('回傳的資料來源與本次同步不同。');
        if(receive(data.payload,current.profile))event.source.postMessage({type:'PSGB_HISTORY_SAVED',session:current.session},event.origin);
      }catch(error){say(error.message);}open();
    }
  });
  $('history-cancel').onclick=()=>{if(bridge?.kind==='sony')bridge.child.postMessage({type:'PSGB_SONY_CANCEL',session:bridge.session},bridge.origin);stop();say('已停止等待回傳。');};
  $('history-import').onclick=()=>$('history-file').click();
  $('history-file').onchange=async()=>{
    try{
      writable();const file=$('history-file').files[0];if(!file)return;if(file.size>15*1024*1024)throw Error('遊玩紀錄 JSON 上限 15 MB。');
      const raw=JSON.parse(await file.text());
      if(raw.kind==='ps-game-base-history'){
        const imported=readHistory(raw);for(const snapshot of Object.values(imported.sources))historySnapshot(snapshot,historyProfile($('history-profile').value));
        // Commit the container once, so a failure cannot leave a half import.
        const previous=getState().history;let next=previous;for(const snapshot of Object.values(imported.sources))next=mergeHistory(next,snapshot);
        setHistory(next);if(!save()){setHistory(previous);throw Error('儲存失敗，遊玩紀錄未寫入。');}render();summary();say('已匯入全部遊玩來源，紀錄已加入主清單。');
      }else receive(raw,historyProfile($('history-profile').value));
    }catch(error){say(error.message);}finally{$('history-file').value='';}
  };
  $('history-account-confirm').onclick=()=>{try{if(pending)commit(pending);}catch(error){say(error.message);}};
  $('history-export').onclick=()=>download({kind:'ps-game-base-history',...getState().history},'ps-game-base-history-'+new Date().toISOString().slice(0,10)+'.json');
  summary();
}
