import {profileName, platinumSnapshot, planPlatinums, markPlatinum} from './platinums.js';
import {platformGames as groupGames, workRecordFor} from './model.js';
import {hasRememberedTitle} from './title-aliases.js';

export function initPlatinums({getState,setPersonal,save,render,notice,isDemo,isBlocked}) {
  const $=id=>document.getElementById(id);
  const dialog=$('platinum-dialog');
  let bridge=null,timer,report=null,undo=new Map(),completed=new Set();
  function node(tag,text) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  function say(message) {$('platinum-state').textContent=message;}
  function writable() {
    if(isDemo())throw Error('請先離開示範模式，再比對個人白金紀錄。');
    if(isBlocked())throw Error('另一分頁已有新資料，請先重新整理再比對。');
  }
  function stopBridge() {clearTimeout(timer);bridge=null;$('platinum-fetch').disabled=false;}
  function open() {if(!dialog.open)dialog.showModal();}
  $('platinum-open').onclick=$('platinum-settings').onclick=open;
  function apply(work,trophy) {
    const state=getState();
    const record=workRecordFor(state.personal,work);
    if(record.status==='已白金'&&Object.hasOwn(state.personal.works,work.key)&&hasRememberedTitle(record,trophy.name))return false;
    const current=state.personal,own=Object.hasOwn(current.works,work.key),before=structuredClone(current.works[work.key]);
    const next=markPlatinum(current,work,new Date().toISOString(),trophy.name);
    setPersonal(next);
    if(!save()) {setPersonal(current);throw Error('儲存失敗，白金標記未套用。請先匯出備份。');}
    const original=undo.get(work.key)||{own,before};
    undo.set(work.key,{...original,after:structuredClone(next.works[work.key])});
    $('platinum-undo').hidden=false;
    return true;
  }
  function receive(payload,expected) {
    writable();
    const snapshot=platinumSnapshot(payload,expected),state=getState();
    if(!state.library.games.length)throw Error('請先匯入遊戲庫，再比對白金。');
    const plan=planPlatinums(state.library,state.personal,snapshot);
    // Validate the complete snapshot before touching personal data.
    undo=new Map();completed=new Set();$('platinum-undo').hidden=true;
    const unique=[...new Map(plan.automatic.map(entry=>[entry.work.key,entry])).values()];
    const previous=state.personal;
    let next=previous;
    for(const {work} of unique) {
      undo.set(work.key,{own:Object.hasOwn(previous.works,work.key),before:structuredClone(previous.works[work.key])});
      next=markPlatinum(next,work);undo.get(work.key).after=structuredClone(next.works[work.key]);
    }
    if(unique.length) {
      setPersonal(next);
      if(!save()) {setPersonal(previous);undo.clear();throw Error('儲存失敗，白金標記未套用。請先匯出備份。');}
      $('platinum-undo').hidden=false;
    }
    report={snapshot,plan,automatic:unique};
    say(`${snapshot.profile}：讀取 ${snapshot.games.length} 筆白金，已自動標記 ${unique.length} 個平台版本；${plan.already.length} 筆原已標記，${plan.review.length} 筆待確認，${plan.unsupported.length} 筆屬 PS3／PS Vita。`);
    $('platinum-results').hidden=false;
    $('platinum-applied').replaceChildren();
    for(const {work,trophy} of unique) {
      const p=node('p',`${work.name}（白金版本：${trophy.platforms.join(' / ')}${trophy.region?' · '+trophy.region:''}）`);$('platinum-applied').append(p);
    }
    if(!unique.length)$('platinum-applied').append(node('p','沒有新增的自動標記。'));
    render();renderReview();open();
  }
  function renderReview() {
    const list=$('platinum-review');list.replaceChildren();
    if(!report)return;
    const works=groupGames(getState().library.games,getState().library.missingIds);
    const filter=$('platinum-review-search').value.trim().toLocaleLowerCase();
    const pending=report.plan.review.filter(({trophy})=>!completed.has(trophy.psnprofilesId));
    $('platinum-pending').textContent=`待確認 ${pending.length} 筆`;
    const visible=pending.filter(({trophy})=>!filter||trophy.name.toLocaleLowerCase().includes(filter));
    for(const {trophy,reason,candidates} of visible) {
      const row=node('article');row.className='platinum-review-row';
      const source=node('a',trophy.name);source.href=trophy.url;source.target='_blank';source.rel='noopener noreferrer';
      row.append(source,node('p',`${trophy.platforms.join(' / ')}${trophy.region?' · '+trophy.region:''} · ${reason}`));
      const search=node('input');search.placeholder='搜尋庫內作品（可輸入中文名稱）';search.setAttribute('aria-label',trophy.name+'：搜尋庫內作品');
      const select=node('select');select.setAttribute('aria-label',trophy.name+'：選擇對應作品');
      const button=node('button','確認配對並標記白金');button.disabled=true;
      function options() {
        select.replaceChildren();const placeholder=node('option','請手動選擇對應作品');placeholder.value='';select.append(placeholder);
        const term=search.value.trim().toLocaleLowerCase();
        const choices=term?works.filter(w=>w.platforms.some(p=>trophy.platforms.includes(p))&&w.members.some(g=>g.name.toLocaleLowerCase().includes(term))):candidates;
        for(const w of choices) {const opt=node('option',`${w.name} · ${w.platforms.join(' / ')} · ${w.key}`);opt.value=w.key;select.append(opt);}
        button.disabled=true;
      }
      search.oninput=options;select.onchange=()=>{button.disabled=!select.value;};options();
      button.onclick=()=>{
        try {
          writable();const current=getState();const work=groupGames(current.library.games,current.library.missingIds).find(w=>w.key===select.value&&w.platforms.some(p=>trophy.platforms.includes(p)));if(!work)throw Error('請選擇相同平台的庫內版本。');
          const changed=apply(work,trophy);completed.add(trophy.psnprofilesId);
          say(`${trophy.name} → ${work.name}：${changed?'已標記白金並記住名稱配對':'原已標記白金，名稱配對已記住'}。`);render();renderReview();
        } catch(e) {say(e.message);}
      };
      row.append(search,select,button);list.append(row);
    }
    if(!visible.length)list.append(node('p',pending.length?'沒有符合搜尋的待確認紀錄。':'沒有待確認的白金紀錄。'));
  }
  $('platinum-review-search').oninput=renderReview;
  $('platinum-form').onsubmit=e=>{
    e.preventDefault();
    try {
      writable();if(!getState().library.games.length)throw Error('請先匯入遊戲庫，再比對白金。');
      if(bridge)throw Error('已有 PSNProfiles 分頁等待回傳。');
      const profile=profileName($('platinum-profile').value),session=crypto.randomUUID();
      const url=new URL('https://psnprofiles.com/'+profile);
      url.hash=new URLSearchParams({psgbOrigin:location.origin,psgbSession:session}).toString();
      const child=window.open(url.href,'_blank');
      if(!child)throw Error('分頁無法開啟，請允許彈出視窗。');
      bridge={child,session,profile};$('platinum-fetch').disabled=true;
      say('等待 PSNProfiles 分頁回傳。需安裝白金比對腳本；如遇安全驗證，請在該分頁完成。');
      timer=setTimeout(()=>{stopBridge();say('尚未收到完整白金資料。請確認已安裝白金比對腳本，或在 PSNProfiles 分頁匯出 JSON，再從此處匯入。');},300000);
    } catch(e) {say(e.message);}
  };
  $('platinum-cancel').onclick=()=>{stopBridge();say('已停止等待回傳，可重新開啟比對。');};
  window.addEventListener('message',event=>{
    if(!bridge || event.origin!=='https://psnprofiles.com' || event.source!==bridge.child || event.data?.session!==bridge.session)return;
    if(event.data.type==='PSGB_PLATINUM_STATUS')say(String(event.data.message || '').slice(0,1000));
    if(event.data.type==='PSGB_PLATINUM_RESULT') {
      const expected=bridge.profile;stopBridge();
      try {receive(event.data.payload,expected);}catch(e){say('白金比對失敗：'+e.message);}
    }
  });
  $('platinum-import').onclick=()=>$('platinum-file').click();
  $('platinum-file').onchange=async()=>{
    try {
      writable();if(bridge)throw Error('請先停止等待回傳，再匯入白金 JSON。');
      const file=$('platinum-file').files[0];if(!file)return;
      if(file.size>5*1024*1024)throw Error('白金 JSON 上限為 5 MB。');
      const expected=profileName($('platinum-profile').value);
      receive(JSON.parse(await file.text()),expected);
    } catch(e) {say('白金比對失敗：'+e.message);}finally{$('platinum-file').value='';}
  };
  $('platinum-undo').onclick=()=>{
    try {
      writable();const previous=getState().personal,next={...previous,works:Object.assign(Object.create(null),previous.works)};
      let count=0;
      for(const [key,item] of undo) {
        // A later edit must survive an undo of this comparison.
        if(JSON.stringify(previous.works[key])!==JSON.stringify(item.after))continue;
        if(item.own)next.works[key]=item.before;else delete next.works[key];count++;
      }
      setPersonal(next);if(!save()){setPersonal(previous);throw Error('儲存失敗，未復原。');}
      undo.clear();completed.clear();$('platinum-undo').hidden=true;render();renderReview();say(`已復原 ${count} 個平台版本的本次標記；後續另行編輯過的紀錄會保留。`);
    } catch(e) {say(e.message);notice(e.message);}
  };
}
