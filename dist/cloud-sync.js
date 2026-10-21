import {parseImport,library} from './model.js';

const META='ps-game-base.cloud-auto.v1',RECOVERY='ps-game-base.cloud-recovery.v1';
// Public OAuth identifier provided by the site owner; users sign in separately.
const DEFAULT_CLIENT='565579076533-u41tbuhceaeb2ne8qoca7npkecasqkbj.apps.googleusercontent.com';
const clientPattern=/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
function snapshot(raw){
  if(raw?.kind!=='ps-game-base-backup'||raw.schemaVersion!==1)throw Error('雲端資料不是完整遊戲庫備份，已停止同步。');
  const data=parseImport(raw);
  return {schemaVersion:1,kind:'ps-game-base-backup',library:library(data.library),missingIds:[...new Set(data.missingIds)].sort(),personal:data.personal,history:data.history,storeNames:data.storeNames};
}
async function fingerprint(value){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function hasData(value){return value.library.games.length||Object.keys(value.history.sources).length||value.personal.categories.length||Object.keys(value.personal.records).length||Object.keys(value.personal.works).length||Object.keys(value.storeNames.records).length;}
function describe(value){return value.library.games.length+' 筆數位授權、'+Object.values(value.history.sources).reduce((sum,source)=>sum+source.games.length,0)+' 筆遊玩紀錄、'+value.personal.categories.length+' 個自訂分類';}

export function initCloudSync({getSnapshot,applySnapshot,isBlocked,isDemo,isEditing,notice}){
  const $=id=>document.getElementById(id);
  let meta={};
  try{const saved=JSON.parse(localStorage.getItem(META)||'{}');if(saved?.schemaVersion===1)meta=saved;}catch{}
  let clientId=clientPattern.test(meta.clientId||'')?meta.clientId:DEFAULT_CLIENT;
  let auth,drive,prepared=false,preparing=false,account=null,phase='disconnected',message='',busy=false,dirty=false;
  let revision=0,epoch=0,timer=null,retries=0,conflict=null,lastSync=meta.lastSync||null;
  let connectedOnce=false,cachedRemote=null;
  function refresh(){
    const connected=!!auth?.connected&&!!account;
    const texts={disconnected:dirty?'尚未連接雲端 · 有變更尚未同步':'尚未連接雲端 · 資料儲存在此瀏覽器',connecting:'正在連接 Google…',syncing:'正在同步雲端…',pending:'已儲存在此瀏覽器 · 等待同步雲端',synced:'已同步至雲端',conflict:'本機與雲端資料不同 · 請選擇版本',error:'雲端同步未完成'};
    let text=message||texts[phase];
    if(phase==='synced'&&lastSync)text+=' · '+new Date(lastSync).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
    if(isDemo())text='示範模式 · 雲端同步暫停';
    if(isBlocked())text='同步已暫停 · 請先匯出備份並重新整理';
    $('cloud-summary').textContent=text;$('cloud-summary').dataset.state=isBlocked()?'blocked':phase;
    $('cloud-state').textContent=(account?'Google：'+account.email+'\n':'')+text;
    $('cloud-connect').textContent=preparing?'準備 Google 授權…':connected?'已登入 Google':connectedOnce?'重新登入 Google':'使用 Google 登入';
    $('cloud-open').textContent=connected?'雲端設定':'Google 登入';
    $('cloud-connect').disabled=!clientId||busy||preparing||connected||isDemo()||isBlocked();
    $('cloud-now').disabled=!connected||busy||!!conflict||isDemo()||isBlocked();
    $('cloud-disconnect').disabled=!auth?.connected||busy;
    $('cloud-save-config').disabled=busy||!!auth?.connected;
    $('cloud-conflict').hidden=!conflict;
    $('cloud-use-local').disabled=$('cloud-use-remote').disabled=busy||isDemo()||isBlocked();
    if(conflict)$('cloud-conflict-detail').textContent=conflict.reason+'\n此裝置：'+describe(conflict.local)+'\n雲端：'+(conflict.remote?describe(conflict.remote):'沒有備份')+'\n選擇前會在此瀏覽器保留兩份資料作為復原備份。';
  }
  function setPhase(next,text=''){phase=next;message=text;refresh();}
  function cancelTimer(){clearTimeout(timer);timer=null;}
  function current(run){if(run!==epoch||!auth.connected||!account)throw Object.assign(Error('連接已變更，已停止這次同步。'),{code:'cancelled'});if(isBlocked())throw Object.assign(Error('本機儲存或其他分頁狀態已改變，請先匯出備份並重新整理。'),{code:'blocked'});if(isDemo())throw Object.assign(Error('示範模式暫停同步。'),{code:'paused'});}
  function schedule(delay=1400,{background=false}={}){cancelTimer();if(!account||!auth.connected||conflict||isDemo()||isBlocked())return;timer=setTimeout(()=>{timer=null;void sync({background});},delay);}
  function remember(hash){
    const next={schemaVersion:1,clientId,baselineClientId:clientId,owner:account.sub,baseline:hash,lastSync:new Date().toISOString()};
    // Do not claim success unless the baseline survives a refresh.
    localStorage.setItem(META,JSON.stringify(next));meta=next;lastSync=next.lastSync;
  }
  function makeConflict(local,remote,remoteHash,reason){conflict={local,remote,remoteHash,reason};cancelTimer();setPhase('conflict');}
  function recovery(local,remote){localStorage.setItem(RECOVERY,JSON.stringify({schemaVersion:1,savedAt:new Date().toISOString(),local,cloud:remote}));}
  function fail(error){
    if(error.code==='cancelled')return;
    if(error.code==='paused'){refresh();return;}
    if(!auth.connected){setPhase('disconnected','Google 授權已過期 · 本機資料保留，請重新連接');return;}
    setPhase('error',error.message+'（本機資料保留）');
    if(!['blocked','duplicate','permission','invalid'].includes(error.code)&&navigator.onLine&&retries<4)schedule([5000,15000,30000,60000][retries++]);
  }
  function authChanged(){
    if(!auth?.connected){epoch++;account=null;cachedRemote=null;cancelTimer();conflict=null;setPhase('disconnected',connectedOnce?'Google 連接已結束 · 本機資料保留，請重新連接':'');}
    else refresh();
  }
  function createAuth(){auth=new window.SideProjectAuth.GoogleAuth(clientId,authChanged);drive=new window.SideProjectDrive.DriveAppData(auth,'ps-game-base.json');}
  async function prepare(){
    if(prepared||preparing)return;preparing=true;refresh();
    try{await auth.prepare();prepared=true;}catch(error){setPhase('error',error.message);}finally{preparing=false;refresh();}
  }
  async function connect(){
    if(busy||isDemo()||isBlocked())return;
    if(!prepared){await prepare();if(prepared)notice('Google 授權已就緒，請再按一次連接。');return;}
    busy=true;setPhase('connecting');
    try{
      await auth.connect();const run=epoch;
      const identity=await auth.profile();if(run!==epoch||!auth.connected)return;
      account=identity;drive=new window.SideProjectDrive.DriveAppData(auth,'ps-game-base.json');connectedOnce=true;conflict=null;retries=0;setPhase('pending');
    }catch(error){fail(error);}finally{busy=false;refresh();}
    if(account)await sync();
  }
  async function acceptRemote(remote,hash,run,startRevision){
    current(run);
    if(startRevision!==revision){schedule();return false;}
    if(isEditing()){setPhase('pending','雲端有更新 · 完成目前編輯後自動載入');schedule(3000);return false;}
    setPhase('syncing');applySnapshot(remote);remember(hash);dirty=false;return true;
  }
  async function upload(local,hash,result,run){
    current(run);
    if(new Blob([JSON.stringify(local)]).size>5*1024*1024)throw Object.assign(Error('完整備份超過 5 MB，請先匯出 JSON 備份。'),{code:'invalid'});
    setPhase('syncing');
    const value={...local,exportedAt:new Date().toISOString()};
    await drive.write(value,result);current(run);
    // Read back before acknowledging. This also detects simultaneous first uploads.
    const written=await drive.read();current(run);cachedRemote=written;
    if(!written||await fingerprint(snapshot(written.value))!==hash)throw Object.assign(Error('雲端在上傳後又有變更，正在重新比較版本。'),{code:'conflict'});
    remember(hash);
  }
  async function sync({background=false}={}){
    if(busy||!account||!auth.connected||conflict||isDemo()||isBlocked())return;
    if(!navigator.onLine){setPhase('pending','目前離線 · 本機變更會在連線後重試');return;}
    const quiet=background&&phase==='synced'&&!dirty;
    busy=true;cancelTimer();const run=epoch,startRevision=revision;
    // Routine version checks keep the last successful status visible.
    // Transfers, conflicts and errors still update the status explicitly.
    if(!quiet)setPhase('syncing');else refresh();
    try{
      const local=snapshot(getSnapshot()),localHash=await fingerprint(local);
      const result=await drive.read(cachedRemote);current(run);cachedRemote=result;
      const remote=result?snapshot(result.value):null,remoteHash=remote?await fingerprint(remote):null;
      current(run);if(startRevision!==revision){schedule();return;}
      const sameOwner=meta.owner===account.sub&&meta.baselineClientId===clientId;
      const baseline=sameOwner?meta.baseline:null;
      if(remoteHash===localHash){if(!quiet||baseline!==localHash)remember(localHash);dirty=false;}
      else if(!hasData(local)&&!baseline&&remote){if(!await acceptRemote(remote,remoteHash,run,startRevision))return;}
      else if(meta.owner&&!sameOwner&&hasData(local)){makeConflict(local,remote,remoteHash,'此裝置先前連接了另一個 Google 帳號或雲端應用程式，請確認要使用的資料。');return;}
      else if(baseline&&localHash===baseline&&remote){if(!await acceptRemote(remote,remoteHash,run,startRevision))return;}
      else if(!remote&&(!baseline||localHash===baseline)){
        if(baseline){makeConflict(local,null,null,'雲端備份已被移除，請選擇重新上傳此裝置，或保留本機並中斷連接。');return;}
        await upload(local,localHash,null,run);
        dirty=startRevision!==revision;
      }
      else if(baseline&&remoteHash===baseline){await upload(local,localHash,result,run);dirty=startRevision!==revision;}
      else {makeConflict(local,remote,remoteHash,'此裝置與雲端都有不同資料，自動同步已暫停，尚未覆蓋任何版本。');return;}
      retries=0;if(dirty){setPhase('pending');schedule();}else setPhase('synced');
    }catch(error){fail(error);}finally{busy=false;refresh();}
  }
  async function resolve(useLocal){
    if(!conflict||busy||!account||isDemo()||isBlocked())return;
    busy=true;cancelTimer();const run=epoch,startRevision=revision,choice=conflict;
    try{
      const local=snapshot(getSnapshot()),result=await drive.read();current(run);
      const remote=result?snapshot(result.value):null,remoteHash=remote?await fingerprint(remote):null;
      if(startRevision!==revision||remoteHash!==choice.remoteHash){makeConflict(local,remote,remoteHash,'選擇期間資料又有更新，請重新確認兩個版本。');return;}
      recovery(local,remote);
      if(useLocal){const hash=await fingerprint(local);current(run);if(startRevision!==revision){makeConflict(snapshot(getSnapshot()),remote,remoteHash,'此裝置又有修改，請重新確認版本。');return;}await upload(local,hash,result,run);dirty=startRevision!==revision;}
      else {if(!remote)throw Error('雲端沒有可載入的備份，請選擇此裝置版本或中斷連接。');if(!await acceptRemote(remote,remoteHash,run,startRevision))return;}
      conflict=null;retries=0;setPhase(dirty?'pending':'synced');if(dirty)schedule();
    }catch(error){fail(error);}finally{busy=false;refresh();}
  }
  function changed(){revision++;dirty=true;retries=0;if(!conflict&&(!busy||phase==='synced'))setPhase(account?'pending':'disconnected');else refresh();schedule();}
  function wake(){if(phase!=='error'||retries<4)schedule(250,{background:true});}
  function exportRecovery(){
    try{
      const raw=localStorage.getItem(RECOVERY);if(!raw)return notice('此裝置尚無雲端版本切換的復原備份。');
      const saved=JSON.parse(raw),side=$('cloud-recovery-version').value,value=saved[side];
      if(!value)return notice('這份復原備份沒有此版本。');
      downloadSnapshot({...value,exportedAt:saved.savedAt},'recovery-'+side);
    }catch(error){notice('無法讀取復原備份：'+error.message);}
  }
  function downloadSnapshot(value,label){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ps-game-base-cloud-'+label+'-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  createAuth();$('cloud-client-id').value=clientId;
  $('cloud-connect').onclick=connect;
  $('cloud-now').onclick=()=>{retries=0;void sync();};
  $('cloud-disconnect').onclick=()=>{auth.disconnect();};
  $('cloud-open').onclick=()=>{if(account&&auth.connected||busy||isDemo()||isBlocked()){if(!$('data-dialog').open)$('data-dialog').showModal();$('cloud-settings').open=true;}else void connect();};
  $('cloud-use-local').onclick=()=>resolve(true);$('cloud-use-remote').onclick=()=>resolve(false);
  $('cloud-export-local').onclick=()=>downloadSnapshot(getSnapshot(),'local');
  $('cloud-export-remote').onclick=()=>{if(conflict?.remote)downloadSnapshot(conflict.remote,'remote');else notice('雲端沒有可匯出的備份。');};
  $('cloud-export-recovery').onclick=exportRecovery;
  $('cloud-save-config').onclick=()=>{
    const value=$('cloud-client-id').value.trim();if(!clientPattern.test(value))return notice('請輸入有效的 Google 網頁應用程式 Client ID。');
    try{meta={...meta,schemaVersion:1,clientId:value};localStorage.setItem(META,JSON.stringify(meta));}catch{return notice('無法保存授權設定，請確認瀏覽器儲存空間。');}
    clientId=value;prepared=false;createAuth();void prepare();notice('授權設定已儲存，準備完成後可連接 Google。');
  };
  window.addEventListener('online',wake);window.addEventListener('focus',wake);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wake();else if(dirty)void sync();});
  document.addEventListener('close',()=>{if(!isEditing())wake();},true);
  window.addEventListener('beforeunload',event=>{if(dirty&&(account||meta.owner)||busy){event.preventDefault();event.returnValue='';}});
  setInterval(()=>{if(document.visibilityState==='visible')wake();},30000);
  if(meta.baseline){const initialRevision=revision;void fingerprint(snapshot(getSnapshot())).then(hash=>{if(initialRevision===revision)dirty=hash!==meta.baseline;refresh();}).catch(error=>setPhase('error',error.message));}
  refresh();if(clientId)void prepare();else setPhase('disconnected','雲端尚未設定 · 請在雲端設定填入自己的 Google Client ID');
  return {changed,refresh};
}
