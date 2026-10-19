import {historyProfile} from './history.js';

export function initUnifiedSync({historySync,getState,saveLibrary,syncNames,cancelNames,isDemo,isBlocked,notice}){
  const $=id=>document.getElementById(id),dialog=$('sync-dialog');
  let active=null,lastMode='all';
  function say(text){$('sync-status').textContent=text;$('sync-state').textContent=text;}
  function step(id,state){const node=$('sync-step-'+id);node.dataset.state=state;node.querySelector('span').textContent={waiting:'待處理',running:'進行中',done:'完成',error:'未完成',skipped:'此次略過'}[state];}
  function show(){if(!dialog.open)dialog.showModal();}
  function clean(){if(active){clearTimeout(active.timer);clearInterval(active.watcher);}active=null;$('sync-cancel').hidden=true;$('sync-all').disabled=false;$('sync-all').textContent='↻ 同步遊戲庫';for(const id of ['fetch','history-fetch','sync-history-only','sync-profile'])$(id).disabled=false;}
  function fail(run,error){
    if(active!==run)return;
    step(run.stage,'error');const stage=run.stage;lastMode=['history','names'].includes(stage)?stage:run.mode;
    clean();if(stage==='history')historySync.cancel();if(stage==='names')cancelNames();
    say((run.digitalSaved?'數位授權已保存。':'')+error.message);$('sync-retry').hidden=false;
  }
  function finish(run,text){if(active!==run)return;clean();$('sync-retry').hidden=true;say(text);notice(text);}
  async function names(run,snapshot){
    if(active!==run)return;clearInterval(run.watcher);run.stage='names';step('names','running');
    say('3 / 3 · 正在自動補齊官方中英文名稱。');
    const result=await syncNames({onStatus:text=>{if(active===run)say('3 / 3 · '+text);}});
    if(active!==run)return;
    if(!result.complete){fail(run,Error('遊戲資料已保存；'+result.error));return;}
    step('names','done');finish(run,snapshot?'同步完成：'+(run.digitalSaved?run.digitalCount+' 筆數位授權，':'')+snapshot.games.length+' 筆遊玩紀錄、'+snapshot.games.filter(game=>game.platinum).length+' 筆白金。已自動合併並保存。'+(result.failed?'部分商品暫無官方名稱對照。':''):'官方中英文名稱已補齊，遊戲庫已自動合併。');
  }
  function history(run){
    if(active!==run)return;run.stage='history';step('history','running');
    const child=historySync.start({child:run.child,profile:run.profile,
      onStatus:text=>{if(active===run)say('2 / 3 · '+text);},
      onError:error=>fail(run,error),
      onComplete:snapshot=>{if(active!==run)return;step('history','done');void names(run,snapshot);}
    });
    if(active===run)run.child=child;
  }
  function start(mode='all'){
    if(active){show();return;}
    if(isDemo())return notice('請先離開示範模式，再同步個人遊戲庫。');
    if(isBlocked())return notice('另一分頁已有新資料，請先重新整理。');
    if(historySync.busy)return notice('已有來源同步正在進行，請先完成或停止等待。');
    let profile;
    try{profile=historyProfile($('sync-profile').value);if(getState().history?.profile&&getState().history.profile.toLowerCase()!==profile.toLowerCase())throw Error('帳號與已保存的遊玩紀錄不同，請在資料管理確認帳號。');}catch(error){notice(error.message);return;}
    const run={mode,profile,child:null,session:crypto.randomUUID(),stage:mode==='names'?'names':mode==='history'?'history':'digital',digitalSaved:false};active=run;lastMode=mode;
    $('sync-retry').hidden=true;$('sync-cancel').hidden=false;$('sync-all').disabled=true;$('sync-all').textContent='同步中…';
    for(const id of ['fetch','history-fetch','sync-history-only','sync-profile'])$(id).disabled=true;
    step('digital',['history','names'].includes(mode)?'skipped':'running');step('history',['digital','names'].includes(mode)?'skipped':'waiting');step('names',mode==='digital'?'skipped':'waiting');show();
    if(mode==='names')void names(run);
    else if(mode==='history')history(run);
    else{
      const url=new URL('https://library.playstation.com/recently-purchased');url.hash=new URLSearchParams({psgbOrigin:location.origin,psgbSession:run.session}).toString();
      run.child=window.open(url.href,'_blank');
      if(!run.child){fail(run,Error('同步分頁被瀏覽器封鎖，請允許彈出視窗後重試。'));return;}
      say('1 / 3 · 請在來源分頁登入 PlayStation 並切到「已購買」。完成後會自動繼續讀取遊玩與獎盃紀錄。');
      run.timer=setTimeout(()=>fail(run,Error('等候數位遊戲庫逾時。請確認整合腳本已安裝，並在官方分頁切到「已購買」，再重試。')),300000);
    }
    if(active===run&&mode!=='names')run.watcher=setInterval(()=>{if(run.child?.closed)fail(run,Error('來源分頁已關閉，可按「重試未完成步驟」。'));},1500);
  }
  window.addEventListener('message',event=>{
    const run=active;
    if(!run||run.stage!=='digital'||event.origin!=='https://library.playstation.com'||event.source!==run.child||event.data?.session!==run.session)return;
    const message=event.data;
    if(message.type==='PSGB_STATUS')say('1 / 3 · '+String(message.message||'').slice(0,500));
    if(message.type==='PSGB_ERROR')fail(run,Error(String(message.message||'數位遊戲庫讀取失敗。').slice(0,500)));
    if(message.type==='PSGB_RESULT'){
      try{
        const count=saveLibrary(message.payload);clearTimeout(run.timer);run.digitalSaved=true;run.digitalCount=count;step('digital','done');
        if(run.mode==='digital')finish(run,'數位遊戲庫已更新：'+count+' 筆授權。');else history(run);
      }catch(error){fail(run,error);}
    }
  });
  $('sync-all').onclick=()=>start();$('fetch').onclick=()=>start('digital');$('sync-history-only').onclick=()=>start('history');
  $('sync-retry').onclick=()=>start(lastMode);
  $('sync-cancel').onclick=()=>{if(active)fail(active,Error('已停止等待，已保存的資料保留。'));};
  $('sync-profile').value=getState().history?.profile||$('history-profile').value||'chiarubi';
  return {get busy(){return !!active;},refresh(){if(!active&&getState().history?.profile)$('sync-profile').value=getState().history.profile;}};
}
