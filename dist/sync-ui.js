import {historyProfile} from './history.js';
import {assertCatalogAccount} from './model.js';
import {pingScript} from './script-bridge.js';
import {prepareSonyRelay,navigateSonyRelay,stopSonyRelay} from './source-relay.js';

export function initUnifiedSync({historySync,getState,saveLibrary,confirmAccount,syncNames,cancelNames,isDemo,isBlocked,notice}){
  const $=id=>document.getElementById(id),dialog=$('sync-dialog');
  let active=null,lastMode='all',setupMode='all';
  function setup(mode){
    setupMode=mode;const state=getState(),locked=!!(state.history.profile||state.library.games.length&&state.library.account),profile=locked?(state.history.profile||state.library.account.profile):$('sync-profile').value.trim()||state.library.account?.profile||'';
    $('account-setup-profile').value=profile;$('account-setup-profile').readOnly=locked;
    $('account-legacy-ack').hidden=!state.library.games.length||!!state.library.account;$('account-legacy-check').checked=false;$('account-setup-error').textContent='';
    if(!$('account-setup').open)$('account-setup').showModal();
  }
  $('account-setup-form').onsubmit=event=>{
    event.preventDefault();try{
      if(isBlocked())throw Error('請先處理資料保存提示。');
      const profile=historyProfile($('account-setup-profile').value);if(getState().library.games.length||getState().history.profile)assertCatalogAccount(getState(),profile);
      if(!$('account-legacy-ack').hidden&&!$('account-legacy-check').checked)throw Error('請先確認原有數位遊戲庫所屬的 PSN 帳號。');
      if(!confirmAccount(profile)){ $('account-setup-error').textContent='帳號尚未保存，請保留內容並處理資料保存提示後重試。';return;}
      $('sync-profile').value=$('history-profile').value=profile;$('account-setup').close();start(setupMode);
    }catch(error){$('account-setup-error').textContent=error.message;}
  };
  function say(text){$('sync-status').textContent=text;$('sync-state').textContent=text;}
  function step(id,state){const node=$('sync-step-'+id);node.dataset.state=state;node.querySelector('span').textContent={waiting:'待處理',running:'進行中',done:'完成',error:'未完成',skipped:'此次略過'}[state];}
  function show(){if(!dialog.open)dialog.showModal();}
  function clean(){
    if(active){
      clearTimeout(active.timer);active.controller.abort();stopSonyRelay(active.session,active.digitalSaved);
      // Only close the untouched placeholder opened by this run.
      try{if(active.child&&!active.child.closed&&active.child.location.href==='about:blank')active.child.close();}catch{}
    }
    active=null;$('sync-cancel').hidden=true;$('sync-all').disabled=false;$('sync-all').textContent='↻ 同步遊戲庫';for(const id of ['fetch','history-fetch','sync-history-only','sync-profile'])$(id).disabled=false;
  }
  function fail(run,error){
    if(active!==run)return;
    step(run.stage,'error');if(['script-unavailable','script-update'].includes(error.code)){$('script-help').hidden=false;$('script-help-title').textContent=error.code==='script-update'?'請更新整合腳本':'尚未偵測到同步腳本';}
    const stage=run.stage;lastMode=['history','names'].includes(stage)?stage:run.mode;
    clean();if(stage==='history')historySync.cancel();if(stage==='names')cancelNames();
    say((run.digitalSaved?'數位授權已保存。':'')+error.message);$('sync-retry').hidden=false;
  }
  function finish(run,text){if(active!==run)return;clean();$('sync-retry').hidden=true;say(text);$('sync-state').textContent='遊戲庫同步完成';notice(text);}
  async function names(run,snapshot){
    if(active!==run)return;run.stage='names';step('names','running');
    say('3 / 3 · 正在自動補齊官方中英文名稱。');
    const result=await syncNames({onStatus:text=>{if(active===run)say('3 / 3 · '+text);}});
    if(active!==run)return;
    if(!result.complete){fail(run,Error('遊戲資料已保存；'+result.error));return;}
    step('names','done');finish(run,snapshot?'同步完成：'+(run.digitalSaved?run.digitalCount+' 筆數位授權，':'')+snapshot.games.length+' 筆遊玩紀錄、'+snapshot.games.filter(game=>game.platinum).length+' 筆白金。已自動合併並保存。'+(result.failed?'部分商品暫無官方名稱對照。':''):'官方中英文名稱已補齊，遊戲庫已自動合併。');
  }
  function history(run){
    if(active!==run)return;run.stage='history';step('history','running');
    const child=historySync.start({child:run.child,profile:run.profile,
      ...(run.relay?{navigate:url=>navigateSonyRelay(run.session,url,{signal:run.controller.signal})}:{}),
      onStatus:text=>{if(active===run)say('2 / 3 · '+text);},
      onError:error=>fail(run,error),
      onComplete:snapshot=>{if(active!==run)return;step('history','done');void names(run,snapshot);}
    });
    if(active===run)run.child=child;
  }
  async function digital(run){
    if(active!==run)return;
    await prepareSonyRelay(run.session,run.profile,{signal:run.controller.signal});if(active!==run)return;run.relay=true;
    const url=new URL('https://library.playstation.com/recently-purchased');url.hash=new URLSearchParams({psgbOrigin:location.origin,psgbSession:run.session,psgbProfile:run.profile}).toString();
    run.child.location.href=url.href;
    say('1 / 3 · 請在來源分頁登入 PlayStation、切到「已購買」，並確認登入帳號為 '+run.profile+'。');
    run.timer=setTimeout(()=>fail(run,Error('等候數位遊戲庫逾時。請確認整合腳本已安裝，並在官方分頁切到「已購買」，再重試。')),300000);
  }
  async function begin(run){
    try{
      say('正在確認同步腳本…');
      const ready=await pingScript({timeout:3000,signal:run.controller.signal});
      if(active!==run)return;
      const version=String(ready?.version||'').split('.').map(Number),minimum=[0,3,7],different=minimum.findIndex((value,index)=>version[index]!==value);
      if(!ready?.onlineNames||!ready?.sonyRelay||version.length!==3||version.some(value=>!Number.isSafeInteger(value)||value<0)||different>=0&&version[different]<minimum[different])throw Object.assign(Error('請更新整合腳本至 v0.3.7，並重新整理遊戲庫與來源分頁。'),{code:'script-update'});
      $('script-help').hidden=true;
      if(active!==run)return;
      if(run.mode==='names')await names(run);else if(run.mode==='history')history(run);else await digital(run);
    }catch(error){fail(run,error);}
  }
  function start(mode='all'){
    if(active){show();return;}
    if(isDemo())return notice('請先離開示範模式，再同步個人遊戲庫。');
    if(isBlocked())return notice('請先處理資料保存提示，再開始同步。');
    if(historySync.busy)return notice('已有來源同步正在進行，請先完成或停止等待。');
    let profile;
    const state=getState(),requested=$('sync-profile').value.trim();
    if(!state.library.account||!requested||!state.library.games.length&&!state.history.profile&&requested.toLowerCase()!==state.library.account.profile.toLowerCase()){setup(mode);return;}
    try{profile=historyProfile($('sync-profile').value);assertCatalogAccount(getState(),profile);}catch(error){notice(error.message);return;}
    const run={mode,profile,child:null,session:crypto.randomUUID(),stage:mode==='names'?'names':mode==='history'?'history':'digital',digitalSaved:false,relay:false,controller:new AbortController()};active=run;lastMode=mode;
    $('script-help').hidden=true;$('sync-retry').hidden=true;$('sync-cancel').hidden=false;$('sync-all').disabled=true;$('sync-all').textContent='同步中…';
    for(const id of ['fetch','history-fetch','sync-history-only','sync-profile'])$(id).disabled=true;
    step('digital',['history','names'].includes(mode)?'skipped':'running');step('history',['digital','names'].includes(mode)?'skipped':'waiting');step('names',mode==='digital'?'skipped':'waiting');show();
    if(mode==='names')void begin(run);
    else{
      // Open synchronously during the user's click, before awaiting the script
      // check, so the source tab is not blocked as an unsolicited popup.
      run.child=window.open('about:blank','_blank');
      if(!run.child){fail(run,Error('同步分頁被瀏覽器封鎖，請允許彈出視窗後重試。'));return;}
      void begin(run);
    }
    // Source liveness is governed by relay replies and the phase timeout.

  }
  window.addEventListener('message',event=>{
    const run=active;
    if(!run||run.stage!=='digital')return;
    const relayed=event.origin===location.origin&&(event.source===window||event.source===null)&&event.data?.type==='PSGB_SONY_RELAY_MESSAGE'&&event.data.sourceOrigin==='https://library.playstation.com';
    if(relayed&&!run.relay)return;
    if(!relayed&&(event.origin!=='https://library.playstation.com'||event.source!==run.child))return;
    const message=relayed?event.data.message:event.data;
    if(message?.session!==run.session||relayed&&event.data.session!==run.session)return;
    if(message.type==='PSGB_STATUS')say('1 / 3 · '+String(message.message||'').slice(0,500));
    if(message.type==='PSGB_ERROR')fail(run,Error(String(message.message||'數位遊戲庫讀取失敗。').slice(0,500)));
    if(message.type==='PSGB_RESULT'){
      try{
        const count=saveLibrary(message.payload,run.profile);clearTimeout(run.timer);run.digitalSaved=true;run.digitalCount=count;step('digital','done');
        if(run.mode==='digital')finish(run,'數位遊戲庫已更新：'+count+' 筆授權。');else history(run);
      }catch(error){fail(run,error);}
    }
  });
  $('sync-all').onclick=()=>start();$('fetch').onclick=()=>start('digital');$('sync-history-only').onclick=()=>start('history');
  $('sync-retry').onclick=()=>start(lastMode);
  $('sync-cancel').onclick=()=>{if(active)fail(active,Error('已停止等待，已保存的資料保留。'));};
  $('sync-profile').value=getState().library.account?.profile||getState().history.profile||'';
  return {get busy(){return !!active;},refresh(){const profile=getState().library.account?.profile||getState().history.profile;if(!active&&profile)$('sync-profile').value=profile;}};
}
