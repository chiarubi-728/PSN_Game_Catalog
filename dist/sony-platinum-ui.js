import {sonyProfile,sonyRequest,sonySnapshot,planSonyPlatinums} from './sony-platinums.js';
import {markPlatinum} from './platinums.js';
import {platformGames as groupGames,workRecordFor} from './model.js';
import {hasRememberedTitle} from './title-aliases.js';
export function initSonyPlatinums({getState,setPersonal,save,render,isDemo,isBlocked}){
  const $=id=>document.getElementById(id),dialog=$('sony-dialog'),key=t=>t.npServiceName+':'+t.npCommunicationId;
  let bridge=null,timer,report=null,undo=new Map(),completed=new Set(),accountConfirmed=false;
  const say=text=>{$('sony-state').textContent=text;};
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const open=()=>{if(!dialog.open)dialog.showModal();};
  function writable(){if(isDemo())throw Error('請先離開示範模式。');if(isBlocked())throw Error('另一分頁已有新資料，請先重新整理。');if(!getState().library.games.length)throw Error('請先匯入遊戲庫。');}
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function stopBridge(){clearTimeout(timer);bridge=null;$('sony-start').disabled=false;$('sony-profile').disabled=false;}
  $('sony-open').onclick=$('sony-settings').onclick=open;
  function commit(entries){
    const state=getState(),previous=state.personal,nextUndo=new Map([...undo].map(([id,item])=>[id,{...item}]));let next=previous,count=0;
    for(const {work,trophy,remember} of entries){
      const record=workRecordFor(next,work),matchedName=remember?trophy?.name:undefined;
      if(record.status==='已白金'&&Object.hasOwn(next.works,work.key)&&(!matchedName||hasRememberedTitle(record,matchedName)))continue;
      if(!nextUndo.has(work.key))nextUndo.set(work.key,{own:Object.hasOwn(previous.works,work.key),before:structuredClone(previous.works[work.key])});
      next=markPlatinum(next,work,new Date().toISOString(),matchedName);nextUndo.get(work.key).after=structuredClone(next.works[work.key]);count++;
    }
    if(count){setPersonal(next);if(!save()){setPersonal(previous);throw Error('儲存失敗，白金標記未套用。');}undo=nextUndo;}
    $('sony-undo').hidden=!undo.size;return count;
  }
  function applyAutomatic(){
    writable();if(!report||!accountConfirmed)return;
    const state=getState(),plan=planSonyPlatinums(state.library,state.personal,report.snapshot),count=commit(plan.automatic);
    report.applied.push(...plan.automatic);report.plan=plan;
    say(`${report.expected}：已確認 ${count} 個平台版本的白金；${plan.already.length} 個平台版本原已標記；${plan.review.length} 筆待手動確認。${report.snapshot.complete?'':'查詢未全部完成，僅採用已確認的白金對應。'}`);
    render();renderReport();
  }
  function receive(payload,expected){
    writable();const snapshot=sonySnapshot(payload,expected),state=getState(),plan=planSonyPlatinums(state.library,state.personal,snapshot);
    undo=new Map();completed=new Set();accountConfirmed=snapshot.profile.verified;
    report={snapshot,plan,expected,applied:[]};$('sony-results').hidden=false;$('sony-undo').hidden=true;
    if(accountConfirmed)applyAutomatic();else{say('已收到比對結果。Sony 未提供可驗證的帳號名稱；請先確認資料的帳號，再套用標記。');renderReport();}
    open();
  }
  function renderReport(){
    if(!report)return;
    const {snapshot,plan}=report;
    $('sony-account-confirm').hidden=accountConfirmed;
    $('sony-account-confirm').textContent=`我確認資料屬於 ${report.expected}，套用已確認的白金對應`;
    $('sony-info').textContent=`已查詢 ${plan.queried} 個遊戲 ID，${plan.mapped} 個有獎盃清單對應；白金清單 ${snapshot.games.length} 筆。${plan.noTitleId?'庫內 '+plan.noTitleId+' 筆授權缺少一致的遊戲 ID。':''}${plan.unsupported.length?'另有 '+plan.unsupported.length+' 筆為 PS3／PS Vita 等平台。':''}${snapshot.failures.length?'有 '+snapshot.failures.length+' 筆查詢問題，可保留結果後重試。':''}`;
    const applied=$('sony-applied');applied.replaceChildren();
    const proofLabels={'name-platform':'名稱＋平台唯一相符','localized-title':'中英文名稱對照＋平台','remembered-title':'已記住的名稱配對＋平台'};
    for(const {work,proofs} of report.applied){applied.append(node('p',`${work.name}\n${proofs.map(p=>p.platform+' · '+(proofLabels[p.source]||p.titleId)+' → '+p.npCommunicationId).join('\n')}`));}
    if(!report.applied.length)applied.append(node('p',accountConfirmed?'本次沒有新增的自動標記。':'確認帳號後才會新增標記。'));
    const pending=plan.review.filter(entry=>!completed.has(key(entry.trophy))),term=$('sony-search').value.trim().toLocaleLowerCase(),visible=pending.filter(entry=>!term||entry.trophy.name.toLocaleLowerCase().includes(term));
    $('sony-pending').textContent=`待手動確認 ${pending.length} 筆`;
    const list=$('sony-review');list.replaceChildren();
    const works=groupGames(getState().library.games,getState().library.missingIds);
    for(const entry of visible.slice(0,80)){
      const {trophy,reason,candidates}=entry,row=node('article');row.className='platinum-review-row';
      row.append(node('strong',trophy.name),node('p',`${trophy.platforms.join(' / ')} · ${trophy.npCommunicationId}\n${reason}`));
      const search=node('input');search.placeholder='搜尋庫內中文或英文名稱';search.setAttribute('aria-label',trophy.name+'：搜尋庫內作品');
      const select=node('select');select.setAttribute('aria-label',trophy.name+'：選擇作品');
      const button=node('button','確認配對並標記白金');
      function options(){
        select.replaceChildren();const first=node('option','請手動選擇對應作品');first.value='';select.append(first);
        const query=search.value.trim().toLocaleLowerCase(),choices=query?works.filter(w=>w.platforms.some(p=>trophy.platforms.includes(p))&&w.members.some(g=>g.name.toLocaleLowerCase().includes(query))):candidates;
        for(const work of choices.slice(0,100)){const option=node('option',`${work.name} · ${work.platforms.join(' / ')}`);option.value=work.key;select.append(option);}
        button.disabled=true;
      }
      search.oninput=options;select.onchange=()=>{button.disabled=!select.value||!accountConfirmed;};options();
      button.onclick=()=>{try{writable();if(!accountConfirmed)throw Error('請先確認帳號。');const work=groupGames(getState().library.games,getState().library.missingIds).find(w=>w.key===select.value&&w.platforms.some(p=>trophy.platforms.includes(p)));if(!work)throw Error('請選擇相同平台的庫內作品。');const count=commit([{work,trophy,remember:true}]);completed.add(key(trophy));say(`${trophy.name} → ${work.name}：${count?'已標記白金並記住名稱配對':'原已標記白金，名稱配對已記住'}。`);render();renderReport();}catch(e){say(e.message);}};
      row.append(search,select,button);list.append(row);
    }
    if(!visible.length)list.append(node('p',pending.length?'沒有符合搜尋的項目。':'沒有待確認的白金紀錄。'));
    if(visible.length>80)list.append(node('p',`先顯示 80 筆，共 ${visible.length} 筆；可用上方搜尋縮小範圍。`));
  }
  $('sony-account-confirm').onclick=()=>{try{accountConfirmed=true;applyAutomatic();}catch(e){say(e.message);}};
  $('sony-search').oninput=renderReport;
  $('sony-start').onclick=()=>{
    try{
      writable();if(bridge)throw Error('已有官方分頁等待回傳。');
      const request=sonyRequest(getState().library,$('sony-profile').value),session=crypto.randomUUID(),url=new URL('https://library.playstation.com/recently-purchased');
      url.hash=new URLSearchParams({psgbSonyOrigin:location.origin,psgbSonySession:session}).toString();
      const child=window.open(url.href,'_blank');if(!child)throw Error('請允許開啟官方分頁，或改用匯出比對清單。');
      bridge={child,session,request};$('sony-start').disabled=true;$('sony-profile').disabled=true;
      say(`準備比對 ${request.titleIds.length} 個遊戲 ID。請在官方分頁的助手面板按「開始整批比對」。如未收到清單，請使用匯出清單／匯入結果。`);
      timer=setTimeout(()=>{stopBridge();say('已停止等待。官方分頁完成後仍可匯出 Sony 白金 JSON，再從這裡匯入。');},1200000);
    }catch(e){say(e.message);}
  };
  $('sony-export-request').onclick=()=>{try{writable();download(sonyRequest(getState().library,$('sony-profile').value),'ps-game-base-sony-request.json');say('已匯出比對清單。請在官方遊戲庫助手面板選「匯入比對清單」。');}catch(e){say(e.message);}};
  $('sony-stop').onclick=()=>{if(bridge)try{bridge.child.postMessage({type:'PSGB_SONY_CANCEL',session:bridge.session},'https://library.playstation.com');}catch{}stopBridge();say('已停止等待回傳。');};
  window.addEventListener('message',event=>{
    if(!bridge||event.origin!=='https://library.playstation.com'||event.source!==bridge.child||event.data?.session!==bridge.session)return;
    if(event.data.type==='PSGB_SONY_READY')bridge.child.postMessage({type:'PSGB_SONY_REQUEST',session:bridge.session,request:bridge.request},event.origin);
    if(event.data.type==='PSGB_SONY_STATUS')say(String(event.data.message||'').slice(0,500));
    if(event.data.type==='PSGB_SONY_RESULT'){const expected=bridge.request.expectedProfile;stopBridge();try{receive(event.data.payload,expected);}catch(e){say(e.message);}}
  });
  $('sony-import').onclick=()=>$('sony-file').click();
  $('sony-file').onchange=async()=>{try{writable();const file=$('sony-file').files[0];if(!file)return;if(file.size>15*1024*1024)throw Error('Sony 白金 JSON 上限 15 MB。');stopBridge();receive(JSON.parse(await file.text()),sonyProfile($('sony-profile').value));}catch(e){say(e.message);}finally{$('sony-file').value='';}};
  $('sony-undo').onclick=()=>{
    try{
      writable();const previous=getState().personal,next={...previous,works:Object.assign(Object.create(null),previous.works)};let count=0;
      for(const [id,item] of undo){if(JSON.stringify(previous.works[id])!==JSON.stringify(item.after))continue;if(item.own)next.works[id]=item.before;else delete next.works[id];count++;}
      setPersonal(next);if(!save()){setPersonal(previous);throw Error('儲存失敗，未復原。');}undo.clear();completed.clear();$('sony-undo').hidden=true;
      if(report){report.applied=[];report.plan=planSonyPlatinums(getState().library,next,report.snapshot);renderReport();}
      render();say(`已復原 ${count} 個平台版本的本次標記。另行編輯過的作品保留目前資料。`);
    }catch(e){say(e.message);}
  };
}
