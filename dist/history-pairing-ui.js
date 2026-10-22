import {unifiedCatalog,catalogRecordFor,historyRecordKey} from './catalog.js';
import {historyEntries,historyLinkKey,targetForCard,cardMatchesTarget,canPairHistory,digitalRegions,readHistoryLinks} from './history-links.js';
import {matchesCatalogSearch,catalogSearchKey} from './catalog-search.js';

const providerName={sony:'Sony',psnprofiles:'PSNProfiles'};
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};

export function initHistoryPairing({getState,getCatalog}){
  const $=id=>document.getElementById(id);
  let card=null,base=new Map(),draft=new Map(),changed=new Set(),catalog=[],entries=[],owners=new Map();
  const mapLinks=personal=>new Map((personal.historyLinks||[]).map(link=>[historyLinkKey(link.provider,link.id),link]));
  function withLinks(personal,links){const next={...personal};if(links.length)next.historyLinks=links;else delete next.historyLinks;return next;}
  function currentCard(){return catalog.find(item=>cardMatchesTarget(item,targetForCard(card)))||card;}
  function refreshOwners(){owners=new Map();for(const item of catalog)for(const entry of item.historyEntries)owners.set(historyLinkKey(entry.provider,entry.id),item);}
  function setLink(entry,target){
    const key=historyLinkKey(entry.provider,entry.id);
    draft.set(key,{provider:entry.provider,id:entry.id,target,updatedAt:new Date().toISOString()});
    same(draft.get(key),base.get(key))?changed.delete(key):changed.add(key);
  }
  function redraw(){
    const state=getState();catalog=unifiedCatalog(state.library,withLinks(state.personal,[...draft.values()]),state.history,state.storeNames);refreshOwners();render();
    ($('pairing-status').textContent?$('pairing-status'):$('pairing-search')).focus({preventScroll:true});
  }
  function choose(entry){
    const target=targetForCard(card);
    for(const current of currentCard().historyEntries)if(current.provider===entry.provider&&current.id!==entry.id)setLink(current,null);
    for(const link of [...draft.values()])if(link.provider===entry.provider&&link.id!==entry.id&&link.target&&cardMatchesTarget(card,link.target))setLink(link,null);
    setLink(entry,target);redraw();
  }
  function restore(entry){
    const key=historyLinkKey(entry.provider,entry.id);draft.delete(key);
    base.has(key)?changed.add(key):changed.delete(key);redraw();
  }
  function action(text,callback,{disabled=false,primary=false}={}){
    const button=element('button',text,primary?'primary':undefined);button.type='button';button.disabled=disabled;button.onclick=callback;return button;
  }
  function row(entry){
    const item=element('article',undefined,'history-pair-row'),info=element('div',undefined,'history-pair-info');
    if(entry.imageUrl){const image=element('img');image.src=entry.imageUrl;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';item.append(image);}
    info.append(element('strong',entry.name));
    const progress=[entry.progress!==null?entry.progress+'%':null,entry.earnedTotal!==null?entry.earnedTotal+(entry.definedTotal!==null?' / '+entry.definedTotal:'')+' 個獎盃':null,entry.platinum?'已取得白金':null].filter(Boolean).join(' · ');
    info.append(element('p',entry.platforms.join(' / ')+' · '+providerName[entry.provider]+' #'+entry.id+(progress?' · '+progress:'')));
    const regions=digitalRegions(card);
    if(entry.region){info.append(element('p','來源區域：'+entry.region+(regions.length?' · 數位授權區域：'+regions.join(' / '):'')));if(regions.length&&!regions.includes(entry.region))info.append(element('p','區域標示不同，請核對是否為同款版本。','pairing-warning'));}
    const key=historyRecordKey(entry),member={name:entry.name,platform:entry.platforms.join('/'),entitlementId:key};
    const record=catalogRecordFor(withLinks(getState().personal,[...draft.values()]),{key,members:[member],historyEntries:[entry]});
    const savedLabels=[...(record.manualPlatinum===true?['個人白金']:[]),...(record.status!=='未開始'?[record.status]:[]),...record.categories,...record.tags.map(tag=>'#'+tag)];
    if(savedLabels.length)info.append(element('p','來源分類／標籤：'+savedLabels.join(' · ')));
    if(record.note){const note=element('p','來源筆記：'+(record.note.length>120?record.note.slice(0,120)+'…':record.note),'preserve-lines');note.title=record.note;info.append(note);}
    item.append(info);return item;
  }
  function render(){
    if(!card)return;
    const current=currentCard(),currentNode=$('pairing-current');currentNode.replaceChildren();
    for(const entry of current.historyEntries){
      const item=row(entry);item.querySelector('.history-pair-info').append(element('p',(entry.pairing==='manual'?'手動配對':'自動對照')+(changed.has(historyLinkKey(entry.provider,entry.id))?'（待儲存）':'')));item.append(action('解除配對',()=>{setLink(entry,null);redraw();}));currentNode.append(item);
    }
    for(const link of draft.values())if(link.target&&cardMatchesTarget(card,link.target)&&!current.historyEntries.some(entry=>entry.provider===link.provider&&entry.id===link.id)){
      const entry=entries.find(item=>item.provider===link.provider&&item.id===link.id),item=element('article',undefined,'history-pair-row');
      item.append(element('p',(entry?.name||providerName[link.provider]+' #'+link.id)+'：原配對目前無法套用，可解除後重新選擇。'),action('解除配對',()=>{setLink(link,null);redraw();}));currentNode.append(item);
    }
    if(!currentNode.childElementCount)currentNode.append(element('p','目前沒有配對的遊玩紀錄。'));
    const query=$('pairing-search').value.trim(),key=catalogSearchKey(card.name);
    const candidates=entries.filter(entry=>canPairHistory(card,entry)&&owners.get(historyLinkKey(entry.provider,entry.id))?.key!==current.key&&matchesCatalogSearch([entry.name],query));
    candidates.sort((a,b)=>{
      const rank=entry=>{const name=catalogSearchKey(entry.name);return name===key?2:name.includes(key)||key.includes(name)?1:0;};
      return rank(b)-rank(a)||a.name.localeCompare(b.name,'zh-Hant')||a.id.localeCompare(b.id);
    });
    const list=$('pairing-candidates');list.replaceChildren();
    for(const entry of candidates.slice(0,40)){
      const id=historyLinkKey(entry.provider,entry.id),owner=owners.get(id),item=row(entry),controls=element('div',undefined,'history-pair-actions');
      if(owner?.digitalMembers.length){item.querySelector('.history-pair-info').append(element('p','已配對到「'+owner.name+' · '+owner.platforms.join(' / ')+'」。請先到該卡片解除配對。'));controls.append(action('已配對其他遊戲',()=>{},{disabled:true}));}
      else{
        if(draft.get(id)?.target===null)item.querySelector('.history-pair-info').append(element('p','目前設定為保持分開。'));
        controls.append(action('選擇這筆',()=>choose(entry),{primary:true}));
        if(draft.has(id))controls.append(action('恢復自動對照',()=>restore(entry)));
      }
      item.append(controls);list.append(item);
    }
    if(!candidates.length)list.append(element('p',query?'沒有符合搜尋的同平台紀錄，請換個名稱搜尋。':'目前沒有其他同平台遊玩紀錄；請先同步遊戲庫。'));
    $('pairing-count').textContent='找到 '+candidates.length+' 筆'+(candidates.length>40?'，先顯示前 40 筆，請搜尋縮小範圍。':'。');
    $('pairing-status').textContent=changed.size?'配對變更尚未儲存，請按下方「儲存整理」。':'';
  }
  $('pairing-search').oninput=render;
  $('pairing-search').onkeydown=event=>{if(event.key==='Enter')event.preventDefault();};
  return {
    open(work){
      card=work;base=mapLinks(getState().personal);draft=new Map(base);changed=new Set();catalog=[...getCatalog()];entries=historyEntries(getState().history);refreshOwners();
      const supported=work.digitalMembers.length&&work.platforms.length===1;
      $('edit-pairing').hidden=!supported;$('edit-pairing-hint').hidden=!!supported;$('pairing-search').value='';
      if(supported)render();
    },
    get dirty(){return changed.size>0;},
    showError(text){$('edit-advanced').open=true;$('edit-pairing').open=true;$('pairing-status').textContent=text;$('pairing-status').focus();},
    prepare(personal){
      if(!changed.size)return personal;
      const latest=mapLinks(personal),state=getState(),sources=historyEntries(state.history),cards=[...getCatalog()];
      for(const key of changed){
        if(!same(latest.get(key),base.get(key)))throw Error('配對設定已變更，請重新開啟遊戲後再選擇。');
        const next=draft.get(key);
        if(next?.target){
          const entry=sources.find(item=>item.provider===next.provider&&item.id===next.id),targets=cards.filter(item=>cardMatchesTarget(item,next.target));
          if(!entry||targets.length!==1||!canPairHistory(targets[0],entry))throw Error('來源或平台資料已更新，請重新開啟遊戲後再配對。');
          const owner=cards.find(item=>item.historyEntries.some(source=>source.provider===next.provider&&source.id===next.id));
          if(owner?.digitalMembers.length&&owner.key!==targets[0].key)throw Error('這筆紀錄已配對其他遊戲，請先解除原配對。');
        }
        next?latest.set(key,next):latest.delete(key);
      }
      return withLinks(personal,readHistoryLinks([...latest.values()]));
    },
    close(){card=null;base=new Map();draft=new Map();changed.clear();catalog=[];entries=[];owners.clear();},
  };
}
