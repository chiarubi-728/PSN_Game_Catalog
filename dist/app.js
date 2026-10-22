import {initUnifiedSync} from './sync-ui.js';
// PSGB_PLATFORM_SPLIT_V1
import {initHistorySync} from './history-ui.js';
import {emptyHistory,readHistory,mergeHistory,trophyStatistics} from './history.js';
import {unifiedCatalog,catalogRecordFor,catalogView,catalogRecordNotes} from './catalog.js';
import {emptyStoreNames,readStoreNames,mergeStoreNames} from './store-names.js';
import {initStoreNames} from './store-names-ui.js';
import {classificationOptions, classificationFor, personalPlatinum, library, personal, emptyPersonal, blankRecord, hasWorkConflicts, mergeLibrary, parseImport, assertCatalogAccount} from './model.js';
import {icon} from './icons.js';
import {catalogSearchKey,matchesCatalogSearch} from './catalog-search.js';
import {initCloudSync} from './cloud-sync.js';
import {progressRange,matchesBrowseFilters,cycleFilter} from './browse-filters.js';
import {categoryPopover} from './category-popover.js';
import {compareCatalog,dateSorts,catalogSortPlan} from './catalog-sort.js';
import {dateValue,displayDate} from './dates.js';

const $ = id => document.getElementById(id), KEY = 'ps-game-base.v1', RELEASE_BACKUP_KEY='ps-game-base.before-date-sorting.7a41046';
let state = {library:{schemaVersion:1,complete:false,syncedAt:null,games:[],missingIds:[]},personal:emptyPersonal(),history:emptyHistory(),storeNames:emptyStoreNames()}, view='all', category='', page=1, selected=new Set(), shown=[], eligible=new Set(), pendingImport=null, demo=false;
let works = new Map(),namesSync=null,unifiedSync=null,cloudSync=null;
let localLoadFailed=false,releaseBackupFailed=false,storageFailed=false,externalChanged=false;
let originalStorageRaw=null,loadError='',backupDownloadRequested=false;
const exclusionSettings={unorganized:true,membership:false};
const platformFilters=new Set(),excludedPlatforms=new Set();
const classificationFilters=new Set(),excludedMarks=new Set(),customCategoryFilters=new Set();
// Keep the old filtering record for cards organized while browsing this page.
// Saved data and card controls always use the current record.
const retainedRecords=new Map();let browsingContext='',cardMenuKey='';
function resetBrowsing(){retainedRecords.clear();cardCategoryMenu.close(false);customFilterMenu.close(false);}
function exclusionContext(){if(category)return null;if(view==='unorganized')return 'unorganized';return view==='ps-plus'||view==='non-ps-plus'?'membership':null;}
function notice(message){$('notice').textContent=message;$('notice').classList.add('visible');clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').classList.remove('visible'),8000);}
try{
 originalStorageRaw=localStorage.getItem(KEY);
 if(originalStorageRaw&&!localStorage.getItem(RELEASE_BACKUP_KEY))localStorage.setItem(RELEASE_BACKUP_KEY,JSON.stringify({savedAt:new Date().toISOString(),value:originalStorageRaw}));
}catch{releaseBackupFailed=true;}
try{
 if(originalStorageRaw){const data=JSON.parse(originalStorageRaw);const next={library:{...library(data.library),missingIds:Array.isArray(data.library.missingIds)?data.library.missingIds:[]},personal:personal(data.personal),history:readHistory(data.history),storeNames:readStoreNames(data.storeNames)};assertCatalogAccount(next);state=next;}
 else if(releaseBackupFailed)throw Error('無法讀取瀏覽器存檔。');
}catch(error){localLoadFailed=true;loadError=error.message;}
let savedState=state;
function writesBlocked(){return localLoadFailed||externalChanged||releaseBackupFailed;}
function refreshStorageStatus(){
 const panel=$('storage-alert');panel.hidden=!(writesBlocked()||storageFailed);
 $('storage-alert-text').textContent=localLoadFailed?'原始存檔無法讀取，已鎖定寫入：'+loadError+'。請先匯出原始存檔，再匯入完整備份復原。':externalChanged?'其他分頁已更新網站資料，已鎖定此頁寫入。請先匯出需要的資料，再重新載入。':releaseBackupFailed?'更新前備份無法保存，已暫停寫入。請匯出完整備份並確認檔案已保存。':storageFailed?'這次修改未能保存。原有已保存資料保留；編輯內容請留在視窗中，釋放儲存空間後重試。':'';
 $('export-raw-storage').disabled=typeof originalStorageRaw!=='string';
 $('recover-storage').hidden=!localLoadFailed;$('reload-storage').hidden=!(localLoadFailed||externalChanged);
 $('confirm-storage-backup').hidden=!releaseBackupFailed||localLoadFailed;$('confirm-storage-backup').disabled=!backupDownloadRequested;
 cloudSync?.refresh();
}
function commitState(candidate,{fromCloud=false,recover=false}={}){
 if(externalChanged||writesBlocked()&&!recover){notice('寫入已暫停，請先處理「資料保存」提示。');refreshStorageStatus();return false;}
 let next;
 try{const data=parseImport(backupFor(candidate));next={library:{...data.library,missingIds:data.missingIds},personal:data.personal,history:data.history,storeNames:data.storeNames};}
 catch(error){notice('資料尚未保存：'+error.message);return false;}
 if(demo){state=next;return true;}
 try{localStorage.setItem(KEY,JSON.stringify(next));}
 catch{storageFailed=true;notice('瀏覽器儲存失敗，修改尚未保存。請保留編輯內容並重試。');refreshStorageStatus();return false;}
 state=next;savedState=next;storageFailed=false;
 if(recover){localLoadFailed=false;releaseBackupFailed=false;loadError='';}
 if(!fromCloud)cloudSync?.changed();refreshStorageStatus();return true;
}
// Source adapters stage a new immutable state before calling this shared save.
function persist(options){const candidate=state;state=savedState;return commitState(candidate,options);}
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function option(select,value,label){const n=el('option',label??value);n.value=value;select.append(n);}
for(const item of classificationOptions){const label=el('label',undefined,'status-choice'),input=el('input'),visual=el('span',undefined,'status-option');input.type='radio';input.name='classification';input.value=item.value;visual.dataset.tone=item.tone;visual.append(icon(item.icon),el('span',item.label));label.append(input,visual);$('edit-classifications').append(label);input.onchange=()=>{if(input.checked)setEditorStatus(input.value);};}
for(const b of $('views').querySelectorAll('[data-classification]')){const item=classificationFor(b.dataset.classification);b.dataset.tone=item.tone;b.prepend(icon(item.icon));}
for(const node of document.querySelectorAll('[data-icon]'))node.prepend(icon(node.dataset.icon));
let editorClassificationChanged=false;
function setEditorStatus(value,initial=false){editorClassificationChanged=!initial;$('edit-status').value=value;for(const input of $('edit-classifications').querySelectorAll('input'))input.checked=input.value===value;$('legacy-status').hidden=value==='未開始'||!!classificationFor(value);$('legacy-status').textContent=`保留舊狀態「${value}」。選擇上方分類或清除分類後，才會變更原狀態。`;}
$('clear-status').onclick=()=>setEditorStatus('未開始');
function record(id){return catalogRecordFor(state.personal,works.get(id));}
function update(id,patch){const now=new Date().toISOString(),previous=record(id),next={...previous,...patch,updatedAt:now};if(Object.hasOwn(patch,'status')){delete next.platinumReview;next.statusUpdatedAt=now;if(!Object.hasOwn(patch,'manualPlatinum'))next.manualPlatinum=patch.status==='已白金'||personalPlatinum(previous);}state={...state,personal:{...state.personal,works:Object.assign(Object.create(null),state.personal.works,{[id]:next})}};}
function saveCardPatch(id,patch,{newCategory}={}){
 if(!works.has(id)||writesBlocked()){notice('目前無法修改，請先處理資料保存提示。');return false;}
 const previous=retainedRecords.get(id);if(!previous)retainedRecords.set(id,record(id));
 if(newCategory)state={...state,personal:{...state.personal,categories:[...state.personal.categories,newCategory]}};
 update(id,patch);const saved=persist();
 if(!saved&&!previous)retainedRecords.delete(id);render();return saved;
}
const customFilterMenu=categoryPopover({id:'custom-filter-menu',title:'自訂分類（可複選）',getCategories:()=>state.personal.categories,getSelected:()=>customCategoryFilters,onToggle:(name,checked)=>{checked?customCategoryFilters.add(name):customCategoryFilters.delete(name);retainedRecords.clear();selected.clear();page=1;cardCategoryMenu.close(false);render();return true;}});
const cardCategoryMenu=categoryPopover({id:'card-category-menu',title:'加入自訂分類',getCategories:()=>state.personal.categories,getSelected:()=>works.has(cardMenuKey)?record(cardMenuKey).categories:[],onToggle:(name,checked)=>{const r=record(cardMenuKey);return saveCardPatch(cardMenuKey,{categories:checked?[...new Set([...r.categories,name])]:r.categories.filter(value=>value!==name)});},onCreate:name=>{
 if(!name||name.length>100){notice('分類名稱請填寫 1–100 字。');return false;}
 if(state.personal.categories.includes(name)){notice('這個分類已存在，可直接勾選加入。');return false;}
 return saveCardPatch(cardMenuKey,{categories:[...record(cardMenuKey).categories,name]},{newCategory:name});
}});
function backupFor(value){return {schemaVersion:1,kind:'ps-game-base-backup',exportedAt:new Date().toISOString(),library:library(value.library),missingIds:value.library.missingIds||[],personal:value.personal,history:readHistory(value.history),storeNames:readStoreNames(value.storeNames)};}
function backup(){return backupFor(state);}
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=`ps-game-base-${name}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function renderFilterChip(button,included,excluded,value){
 if(!button.dataset.filterLabel)button.dataset.filterLabel=button.textContent.trim();
 const state=included.has(value)?'include':excluded.has(value)?'exclude':'none',label=button.dataset.filterLabel;
 let marker=button.querySelector('.filter-indicator');if(!marker){marker=el('span',undefined,'filter-indicator');marker.setAttribute('aria-hidden','true');button.append(marker);}
 marker.textContent=state==='exclude'?'−':state==='include'?'+':'';button.dataset.filterState=state;button.setAttribute('aria-pressed',String(state!=='none'));
 button.setAttribute('aria-label',label+'：'+(state==='include'?'選取，再按排除':state==='exclude'?'排除，再按取消':'未設定，按下選取'));button.title=button.getAttribute('aria-label');
}
function render(){
 refreshStorageStatus();
 const games=unifiedCatalog(state.library,state.personal,state.history,state.storeNames);works=new Map(games.map(g=>[g.key,g]));
 const query=catalogSearchKey($('catalog-search').value);
 for(const name of customCategoryFilters)if(!state.personal.categories.includes(name))customCategoryFilters.delete(name);
 const progress=progressRange($('progress-min'),$('progress-max')),hasClassFilters=classificationFilters.size>0||excludedMarks.size>0||customCategoryFilters.size>0,includeIgnored=classificationFilters.has('不再遊玩');
 const sortField=$('catalog-sort').value,sortDirection=$('sort-direction').value;
 const context=JSON.stringify([view,category,page,query,[...platformFilters],[...excludedPlatforms],[...classificationFilters],[...excludedMarks],[...customCategoryFilters],$('progress-min').value,$('progress-max').value,exclusionSettings,sortField,sortDirection]);
 if(context!==browsingContext){retainedRecords.clear();cardCategoryMenu.close(false);browsingContext=context;}
 for(const button of $('classification-filters').querySelectorAll('[data-filter-mark]'))renderFilterChip(button,classificationFilters,excludedMarks,button.dataset.filterMark);
 $('custom-category-filter').textContent='自訂分類 ▾';$('custom-category-filter').title=customCategoryFilters.size?'已選 '+customCategoryFilters.size+' 個分類':'自訂分類（可複選）';$('custom-category-filter').classList.toggle('has-selection',customCategoryFilters.size>0);
 $('clear-progress').disabled=!progress.active;$('progress-error').hidden=!progress.invalid;
 for(const input of [$('progress-min'),$('progress-max')])input.setAttribute('aria-invalid',String(progress.invalid));
 $('clear-search').disabled=!$('catalog-search').value;$('clear-search').hidden=!$('catalog-search').value;
 for(const button of $('platform-filters').querySelectorAll('[data-platform]'))renderFilterChip(button,platformFilters,excludedPlatforms,button.dataset.platform);
 const exclusion=exclusionContext();
 const excludeOrganized=!hasClassFilters&&exclusion!==null&&exclusionSettings[exclusion];
 $('exclude-organized').checked=excludeOrganized;$('exclude-organized').disabled=hasClassFilters;
 $('membership-options').title=hasClassFilters?'正在使用分類篩選，暫停排除已分類遊戲。':'';
 $('catalog-stats').hidden=view!=='all'||!!category;
 $('membership-options').hidden=exclusion===null;
 $('heading-count').hidden=$('catalog-stats').hidden;
 const missing=new Set(state.library.missingIds||[]);

 $('stat-total').textContent=$('heading-total').textContent=games.length;
 const overview={unorganized:0,tracked:0,ignored:0};
 for(const game of games){const r=record(game.key);for(const key of Object.keys(overview))if(catalogView(game,r,key))overview[key]++;}
 for(const [key,count] of Object.entries(overview))$('stat-'+key).textContent=count;
 $('stat-entitlements').textContent=state.library.games.length+' 筆原始數位授權';
 const trophyStats=trophyStatistics(state.history),providerName={psnprofiles:'PSNProfiles',sony:'Sony'}[trophyStats.provider];
 $('stat-platinum').textContent=trophyStats.platinum;$('stat-platinum-label').textContent='白金';
 $('stat-platinum-note').textContent=providerName?providerName+' · 依來源獎盃 ID 計數；個人標記另存':'同步遊玩紀錄後顯示來源白金數';
 $('stat-platinum-caption').title=$('stat-platinum-note').textContent;
 const sources=Object.values(state.history?.sources||{});
 const times=[state.library.syncedAt,...sources.map(item=>item.updatedAt)].map(value=>Date.parse(value)).filter(Number.isFinite),latest=times.length?Math.max(...times):null;
 const profile=state.library.account?.profile||state.history?.profile;
 $('summary').textContent=demo?'示範模式 · 操作不會寫入你的遊戲庫':[profile,latest?'最近更新 '+new Date(latest).toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'匯入或同步你的遊戲庫。'].filter(Boolean).join(' · ');
 const names={all:'所有遊戲',unorganized:'尚未整理','ps-plus':'PS Plus','non-ps-plus':'非 PS Plus',platinum:'白金',ignored:'忽略',tracked:'追蹤'};
 $('heading').textContent=category||names[view];
 for(const b of $('views').querySelectorAll('button')){const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 const batchChoice=$('batch-category').value;
 $('categories').replaceChildren();$('batch-category').replaceChildren();option($('batch-category'),'','選擇分類');
 for(const item of classificationOptions)option($('batch-category'),'mark:'+item.value,item.value==='已白金'?'白金（個人標記）':item.label);
 for(const c of state.personal.categories){const b=el('button','◌　'+c);b.classList.toggle('active',category===c);b.onclick=()=>{resetBrowsing();view='all';category=c;selected.clear();page=1;render();};$('categories').append(b);option($('batch-category'),'category:'+c,classificationOptions.some(item=>item.label===c)?c+'（自訂）':c);}
 if([...$('batch-category').options].some(item=>item.value===batchChoice))$('batch-category').value=batchChoice;
 const filtered=games.filter(game=>{const r=retainedRecords.get(game.key)||record(game.key);return (!category||(includeIgnored||r.status!=='不再遊玩')&&r.categories.includes(category))&&catalogView(game,r,view==='unorganized'?'all':view,{includeIgnored})&&(!excludeOrganized||catalogView(game,r,'unorganized'))&&matchesBrowseFilters(game,r,{marks:classificationFilters,categories:customCategoryFilters,progress,platforms:platformFilters,excludedPlatforms,excludedMarks})&&(!query||matchesCatalogSearch([...game.names,...(r.titleAliases||[])],query));});
 eligible=new Set(filtered.map(game=>game.key));for(const id of [...selected])if(!eligible.has(id))selected.delete(id);
 const sortPlan=catalogSortPlan(filtered,sortField);
 filtered.sort((a,b)=>compareCatalog(a,b,{field:sortField,direction:sortDirection,...sortPlan}));
 $('sort-direction').querySelector('[value="asc"]').textContent=sortField==='name'?'名稱正序':'舊到新';
 $('sort-direction').querySelector('[value="desc"]').textContent=sortField==='name'?'名稱反序':'新到舊';
 const pages=Math.max(1,Math.ceil(filtered.length/48));page=Math.min(page,pages);shown=filtered.slice((page-1)*48,page*48);
 $('grid').replaceChildren();$('empty').hidden=filtered.length>0;
 $('empty').querySelector('h2').textContent=games.length?(query?'找不到符合搜尋的遊戲':'目前沒有符合條件的遊戲'):'數位擁有與所有遊玩紀錄，整理在一起。';
 $('empty').querySelector('p').textContent=games.length?'可調整或清除搜尋、平台、分類與獎盃完成率條件；沒有進度的遊戲不會符合百分比篩選。':'匯入官方數位遊戲庫，或按「同步遊戲庫」更新數位授權與全部遊玩紀錄，包含尚未白金的遊戲。';
 $('empty-import').hidden=games.length>0;$('demo').hidden=games.length>0||demo;
 for(const g of shown){const id=g.key,r=record(id),card=el('article',undefined,'card'),art=el('div',undefined,'art');
  const placeholder=el('div',g.name.split(/\s/).map(s=>s[0]).slice(0,3).join(''),'cover-placeholder');art.append(placeholder);
  if(g.imageUrl){const image=el('img');image.src=g.imageUrl;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();art.append(image);}
  const check=el('input');check.type='checkbox';check.className='card-check';check.checked=selected.has(id);check.setAttribute('aria-label','選取 '+g.name+' · '+g.platforms.join(' / '));check.onchange=()=>{check.checked?selected.add(id):selected.delete(id);renderBatch();};art.append(check);
  art.append(quickClassifications(g,r));art.append(el('span',g.platforms.join(' · ')||'PS','platform-badge'));card.append(art);
  const body=el('div',undefined,'card-body'),title=el('button',g.name+' · '+g.platforms.join(' / '),'game-title');title.onclick=()=>edit(g);body.append(title);
  if(sortField!=='name'&&dateValue(g[sortField]))body.append(el('p',dateSorts[sortField]+' · '+displayDate(g[sortField]),'card-date'));
  if(g.platinum||personalPlatinum(r)){const marker=el('span',undefined,'card-classification'),label=g.platinum?'已取得白金':'個人白金標記';marker.dataset.tone='platinum';marker.title=label;marker.setAttribute('role','img');marker.setAttribute('aria-label',label);marker.append(icon('trophy'));card.classList.add('has-classification');card.append(marker);}
  const plusMembers=g.digitalMembers.filter(member=>member.membership==='PS_PLUS');
  if(plusMembers.length){const badge=el('span',undefined,'ps-plus-badge'),historical=plusMembers.every(member=>missing.has(member.entitlementId));badge.title=historical?'歷史 PS Plus 授權（未出現在最近完整同步）':'授權來源：PS Plus';badge.dataset.historical=String(historical);badge.setAttribute('role','img');badge.setAttribute('aria-label',badge.title);badge.append(icon('ps-plus'));card.classList.add('has-ps-plus');card.append(badge);}
  if(g.played){const text=[g.progress!==null?g.progress+'%':'獎盃紀錄已同步',g.earnedTotal!==null?g.earnedTotal+(g.definedTotal!==null?' / '+g.definedTotal:'')+' 個獎盃':''].filter(Boolean).join(' · ');body.append(el('p',text,'trophy-summary'));if(g.progress!==null){const progress=el('progress');progress.max=100;progress.value=g.progress;progress.setAttribute('aria-label','獎盃進度 '+g.progress+'%');body.append(progress);}}
  if(r.categories.length||r.tags.length)body.append(el('p',[...r.categories,...r.tags.map(t=>'#'+t)].join(' · '),'tags'));
  if(g.missingCount)body.append(el('p','部分或全部數位授權未出現在最近完整同步','missing'));
  card.append(body);$('grid').append(card);
 }
 if(cardCategoryMenu.open){const anchor=[...$('grid').querySelectorAll('.quick-folder')].find(button=>button.dataset.workKey===cardMenuKey);anchor?cardCategoryMenu.refresh(anchor):cardCategoryMenu.close(false);}
 customFilterMenu.refresh($('custom-category-filter'));
 $('result-count').textContent='共 '+filtered.length+' 款遊戲';$('page-label').textContent=page+' / '+pages;$('prev').disabled=page===1;$('next').disabled=page===pages;renderBatch();$('reset-demo').hidden=!demo;unifiedSync?.refresh();cloudSync?.refresh();
}
function renderBatch(){$('batch').hidden=!selected.size;$('selected-count').textContent=`已選 ${selected.size} 款遊戲`;$('apply-category').disabled=!selected.size||!$('batch-category').value;}
function quickClassifications(game,r){
 const controls=el('div',undefined,'quick-classifications');controls.setAttribute('role','group');controls.setAttribute('aria-label',game.name+' · '+game.platforms.join(' / ')+'分類');
 for(const value of ['已白金','想玩','不再遊玩']){
  const item=classificationFor(value),button=el('button',undefined,'quick-choice quick-option'),checked=value==='已白金'?personalPlatinum(r):r.status===value;
  button.type='button';button.dataset.tone=item.tone;button.title=value==='已白金'?'個人白金標記（不計入來源白金數）':item.label;button.dataset.workKey=game.key;button.dataset.mark=value;button.setAttribute('aria-pressed',String(checked));button.setAttribute('aria-label',game.name+'：'+item.label);button.append(icon(item.icon));controls.append(button);
  button.onclick=event=>{
   const patch=value==='已白金'?{manualPlatinum:!checked,status:checked?(r.status==='已白金'?'未開始':r.status):(r.status==='未開始'?'已白金':r.status)}:{status:checked?'未開始':value};
   saveCardPatch(game.key,patch);
   if(event.detail===0)[...$('grid').querySelectorAll('.quick-choice')].find(node=>node.dataset.workKey===game.key&&node.dataset.mark===value)?.focus({preventScroll:true});
  };
 }
 const folder=el('button',undefined,'quick-folder quick-option');folder.type='button';folder.title='加入自訂分類';folder.dataset.workKey=game.key;folder.classList.toggle('has-categories',r.categories.length>0);folder.setAttribute('aria-label',game.name+'：加入自訂分類');folder.setAttribute('aria-expanded','false');folder.setAttribute('aria-controls','card-category-menu');folder.append(icon('folder'));folder.onclick=()=>{customFilterMenu.close(false);cardMenuKey=game.key;cardCategoryMenu.toggle(folder);};controls.append(folder);
 return controls;
}
$('platform-review-show').onclick=()=>goView('all');
$('platform-review-sony').onclick=()=>$('history-dialog').showModal();
function goView(next){resetBrowsing();view=next;category='';selected.clear();page=1;render();}
for(const button of $('views').querySelectorAll('button'))button.onclick=()=>goView(button.dataset.view);
document.querySelector('.brand').onclick=event=>{event.preventDefault();goView('all');};
function searchChanged(){resetBrowsing();selected.clear();page=1;render();}
$('catalog-search').addEventListener('input',event=>{if(!event.isComposing)searchChanged();});
$('catalog-search').addEventListener('compositionend',searchChanged);
$('clear-search').onclick=()=>{$('catalog-search').value='';searchChanged();$('catalog-search').focus();};
for(const button of $('platform-filters').querySelectorAll('[data-platform]'))button.onclick=()=>{const platform=button.dataset.platform;cycleFilter(platform,platformFilters,excludedPlatforms);searchChanged();};
for(const button of $('classification-filters').querySelectorAll('[data-filter-mark]')){const item=classificationFor(button.dataset.filterMark);button.prepend(icon(item.icon));button.dataset.tone=item.tone;button.onclick=()=>{cycleFilter(item.value,classificationFilters,excludedMarks);searchChanged();};}
$('custom-category-filter').onclick=()=>{cardCategoryMenu.close(false);customFilterMenu.toggle($('custom-category-filter'));};
for(const input of [$('progress-min'),$('progress-max')])input.addEventListener('input',searchChanged);
$('clear-progress').onclick=()=>{$('progress-min').value=$('progress-max').value='';searchChanged();$('progress-min').focus();};
$('catalog-sort').onchange=()=>{$('sort-direction').value=$('catalog-sort').value==='name'?'asc':'desc';searchChanged();};
$('sort-direction').onchange=searchChanged;
$('exclude-organized').onchange=()=>{const context=exclusionContext();if(context===null)return;exclusionSettings[context]=$('exclude-organized').checked;searchChanged();};
function changePage(delta){resetBrowsing();page+=delta;render();window.scrollTo({top:0,left:0,behavior:'instant'});}
$('prev').onclick=()=>changePage(-1);$('next').onclick=()=>changePage(1);
$('select-all').onclick=()=>{shown.forEach(g=>selected.add(g.key));render();};$('clear-selection').onclick=()=>{selected.clear();render();};
$('batch-category').onchange=renderBatch;
$('apply-category').onclick=()=>{
 const choice=$('batch-category').value,ids=[...selected].filter(id=>works.has(id)&&eligible.has(id));if(!choice||!ids.length)return;
 const marker=choice.startsWith('mark:')?classificationFor(choice.slice(5)):null,c=choice.startsWith('category:')?choice.slice(9):null;
 if(!marker&&(!c||!state.personal.categories.includes(c)))return notice('請重新選擇分類。');
 for(const id of ids)update(id,marker?{status:marker.value}:{categories:[...new Set([...record(id).categories,c])]});
 const saved=persist();if(saved)retainedRecords.clear();render();
 if(saved)notice(`已將 ${ids.length} 款遊戲加入「${marker?marker.label:c}」${marker?.value==='已白金'?'（個人標記，不更動獎盃紀錄）':''}。`);
};
function edit(g){const r=record(g.key);for(const id of ['edit-advanced','edit-versions','edit-official-section','edit-aliases'])$(id).open=false;$('edit-name').textContent=g.name+' · '+(g.platforms.join(' / ')||'未知平台');$('edit-id').value=g.key;$('edit-info').textContent=`${g.platforms.join(' · ')||'未知平台'} · ${g.digitalMembers.length} 筆數位授權 · ${g.played?'有遊玩紀錄':'尚無遊玩紀錄'} · 此平台的筆記獨立保存`;$('edit-platform-review').hidden=true;$('edit-conflicts').hidden=!hasWorkConflicts(state.personal,g);$('edit-dates').hidden=!Object.keys(dateSorts).some(key=>dateValue(g[key]));$('edit-dates').open=false;$('edit-date-list').replaceChildren();for(const [key,label] of Object.entries(dateSorts))$('edit-date-list').append(el('p',label+'：'+displayDate(g[key])));$('edit-versions').hidden=!g.digitalMembers.length;$('edit-version-list').replaceChildren();for(const m of g.digitalMembers){const item=el('p',`${m.platform||'未知平台'} · ${m.membership==='PS_PLUS'?'PS Plus':m.membership==='NONE'?'非 PS Plus':'來源未分類'}${(state.library.missingIds||[]).includes(m.entitlementId)?' · 最近同步未出現':''}`);item.append(el('small',m.productId||m.entitlementId));$('edit-version-list').append(item);}$('edit-history').replaceChildren();for(const entry of g.historyEntries){const row=el('p',entry.name+' · '+entry.platforms.join(' / ')+' · '+(entry.platinum?'已白金':'尚未白金')+(entry.progress!==null?' · '+entry.progress+'%':'')+' · '+(entry.provider==='sony'?'Sony':'PSNProfiles'));if(entry.url){const link=el('a','查看獎盃來源 ↗');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';row.append(document.createTextNode(' '),link);}$('edit-history').append(row);}$('edit-history-section').hidden=!g.played;$('edit-official-names').textContent=(g.officialNames||[]).join(' / ');$('edit-official-section').hidden=!g.officialNames?.length;$('edit-official-links').replaceChildren();const officialUrls=new Set(g.digitalMembers.flatMap(member=>state.storeNames?.records?.[member.productId?.trim().toUpperCase()]?.sourceUrls||[]));for(const url of officialUrls){const link=el('a','Sony 官方名稱來源 ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';$('edit-official-links').append(link);}const preserved=catalogRecordNotes(state.personal,g).filter(item=>item.note!==r.note);$('edit-merged-notes').replaceChildren();$('edit-merged-notes-section').hidden=!preserved.length;$('edit-merged-notes').hidden=!preserved.length;for(const item of preserved){const row=el('p',item.note,'preserve-lines');$('edit-merged-notes').append(row);}setEditorStatus(r.status,true);$('edit-note').value=r.note;$('edit-title-aliases').value=(r.titleAliases||[]).join('\n');$('edit-tags').value=r.tags.join(', ');$('edit-categories').replaceChildren();for(const c of state.personal.categories){const label=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.value=c;check.checked=r.categories.includes(c);label.append(check,document.createTextNode(c));$('edit-categories').append(label);}$('store-link').hidden=!/^[A-Z0-9_-]+$/i.test(g.productId||'');$('store-link').href='https://store.playstation.com/zh-hant-tw/product/'+encodeURIComponent(g.productId||'');$('editor').showModal();}
$('edit-form').onsubmit=e=>{e.preventDefault();const tags=[...new Set($('edit-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean))];if(tags.some(t=>t.length>100))return notice('每個標籤最多 100 字。');const titleAliases=[...new Set($('edit-title-aliases').value.split(/\r?\n/).map(name=>name.trim()).filter(Boolean))];if(titleAliases.length>50||titleAliases.some(name=>name.length>500))return notice('遊戲別名最多 50 個，每個最多 500 字。');update($('edit-id').value,{titleAliases,...(editorClassificationChanged?{status:$('edit-status').value,...($('edit-status').value==='未開始'?{manualPlatinum:false}:{})}:{}),note:$('edit-note').value,tags,categories:[...$('edit-categories').querySelectorAll('input:checked')].map(n=>n.value)});if(!persist())return;retainedRecords.clear();$('editor').close();render();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('settings').onclick=()=>$('data-dialog').showModal();
$('mobile-settings').onclick=()=>$('data-dialog').showModal();
$('mobile-categories').onclick=()=>{renderCategories();$('category-dialog').showModal();};
function renderCategories(){
 $('category-list').replaceChildren();
 for(const c of state.personal.categories){
  const row=el('div',undefined,'category-row'),name=el('span',c),rename=el('button','重新命名'),remove=el('button','刪除');
  const renameInput=el('input'),cancelRename=el('button','取消');renameInput.value=c;renameInput.maxLength=100;renameInput.hidden=cancelRename.hidden=true;renameInput.setAttribute('aria-label','重新命名 '+c);
  rename.onclick=()=>{
   if(renameInput.hidden){renameInput.hidden=cancelRename.hidden=false;name.hidden=true;rename.textContent='儲存';renameInput.focus();renameInput.select();return;}
   const nextName=renameInput.value.trim();if(!nextName)return notice('分類名稱不可空白。');if(nextName===c){cancelRename.click();return;}
   if(nextName.length>100||state.personal.categories.includes(nextName))return notice('名稱過長或已存在。');
   const next=structuredClone(state);next.personal.categories=next.personal.categories.map(value=>value===c?nextName:value);
   for(const r of [...Object.values(next.personal.records),...Object.values(next.personal.works)])r.categories=r.categories.map(value=>value===c?nextName:value);
   if(!commitState(next))return;if(category===c)category=nextName;if(customCategoryFilters.delete(c))customCategoryFilters.add(nextName);resetBrowsing();selected.clear();renderCategories();render();
  };
  remove.onclick=()=>{
   if(!confirm('刪除「'+c+'」分類？遊戲及其他整理紀錄會保留。'))return;
   const next=structuredClone(state);next.personal.categories=next.personal.categories.filter(value=>value!==c);
   for(const r of [...Object.values(next.personal.records),...Object.values(next.personal.works)])r.categories=r.categories.filter(value=>value!==c);
   if(!commitState(next))return;if(category===c)category='';customCategoryFilters.delete(c);resetBrowsing();selected.clear();renderCategories();render();
  };cancelRename.onclick=()=>{renameInput.hidden=cancelRename.hidden=true;renameInput.value=c;name.hidden=false;rename.textContent='重新命名';};row.append(name,renameInput,rename,cancelRename,remove);$('category-list').append(row);
 }
}
$('manage-categories').onclick=()=>{renderCategories();$('category-dialog').showModal();};
$('category-form').onsubmit=event=>{
 event.preventDefault();const name=$('category-name').value.trim();if(!name||state.personal.categories.includes(name))return notice('分類名稱不可空白或重複。');
 const next=structuredClone(state);next.personal.categories.push(name);if(!commitState(next))return;
 $('category-name').value='';renderCategories();render();
};
function preview(data,sourceName){
 const recovering=localLoadFailed;
 if(recovering&&!(data.library&&data.personal&&data.history&&data.storeNames))throw Error('復原需要完整遊戲庫備份，不能使用單獨數位庫或分類檔。');
 if(!recovering){
  if(data.history&&state.history.profile&&data.history.profile&&state.history.profile.toLowerCase()!==data.history.profile.toLowerCase())throw Error('遊玩紀錄屬於不同帳號，未合併。');
  assertCatalogAccount({library:data.library||state.library,history:data.history||state.history},state.library.account?.profile||state.history.profile);
 }
 const profile=data.library?.account?.profile||data.history?.profile||state.library.account?.profile||state.history.profile;
 const unbound=!recovering&&profile&&((state.library.games.length&&!state.library.account)||(data.library?.games.length&&!data.library.account));
 pendingImport={data,source:sourceName,recovering,accountProfile:unbound?profile:null};
 $('import-preview').textContent=recovering?sourceName+'：將用這份完整備份復原並取代目前無法讀取的存檔。':sourceName+'：'+(data.library?data.library.games.length+' 筆數位授權，合併更新。':'')+(data.history?'合併遊玩紀錄。':'')+(data.personal?'個人整理將整份取代。':'個人整理保留。');
 $('recovery-import-ack').hidden=!recovering;$('recovery-import-check').checked=false;
 $('import-account-ack').hidden=!unbound;$('import-account-check').checked=false;
 $('import-account-label').textContent=unbound?'我確認未記錄帳號的數位資料屬於 '+profile+'，可和這份遊玩紀錄合併。':'';
 refreshImportButton();$('confirm-dialog').showModal();
}
function refreshImportButton(){$('confirm-import').disabled=!!pendingImport&&(pendingImport.recovering&&!$('recovery-import-check').checked||pendingImport.accountProfile&&!$('import-account-check').checked);}
$('recovery-import-check').onchange=$('import-account-check').onchange=refreshImportButton;
$('import').onclick=$('empty-import').onclick=$('recover-storage').onclick=()=>$('file').click();
$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>15*1024*1024)throw Error('JSON 檔案上限為 15 MB。');preview(parseImport(JSON.parse(await file.text())),file.name);}catch(error){notice('匯入失敗：'+error.message);}finally{$('file').value='';}};
$('confirm-import').onclick=()=>{
 if(!pendingImport||$('confirm-import').disabled)return;
 try{
  const {data,recovering,accountProfile}=pendingImport;
  let next;
  if(recovering)next={library:{...data.library,missingIds:data.missingIds},personal:data.personal,history:data.history,storeNames:data.storeNames};
  else{
   next=structuredClone(state);const account=accountProfile?{profile:accountProfile,method:'user',confirmedAt:new Date().toISOString()}:null;
   if(account&&next.library.games.length&&!next.library.account)next.library.account=account;
   if(data.library){const incoming={...data.library,...(account&&!data.library.account?{account}:{})};next.library=mergeLibrary(next.library,incoming);if(data.missingIds)next.library.missingIds=data.missingIds.filter(id=>next.library.games.some(game=>game.entitlementId===id));}
   if(data.personal)next.personal=data.personal;
   if(data.history)for(const snapshot of Object.values(data.history.sources))next.history=mergeHistory(next.history,snapshot);
   if(data.storeNames)next.storeNames=mergeStoreNames(next.storeNames,data.storeNames);
  }
  if(!commitState(next,{recover:recovering}))return;
  resetBrowsing();selected.clear();category='';page=1;pendingImport=null;$('confirm-dialog').close();renderCategories();render();notice(recovering?'已從完整備份復原。':'已合併遊戲資料；個人整理依預覽處理。');
 }catch(error){notice('匯入失敗：'+error.message);}
};
function exportRawStorage(){
 if(typeof originalStorageRaw!=='string')return notice('未能讀取原始存檔，請保留此瀏覽器資料並重新載入。');
 const url=URL.createObjectURL(new Blob([originalStorageRaw],{type:'application/json'})),link=el('a');link.href=url;link.download='ps-game-base-original-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('export-raw-storage').onclick=exportRawStorage;$('reload-storage').onclick=()=>location.reload();
$('confirm-storage-backup').onclick=()=>{if(!backupDownloadRequested)return;releaseBackupFailed=false;refreshStorageStatus();notice('已確認完整備份保存，可繼續整理。');};
$('export-library').onclick=()=>{if(localLoadFailed)return exportRawStorage();const value=library(state.library),missing=new Set(state.library.missingIds||[]);value.games=value.games.filter(game=>!missing.has(game.entitlementId));download(value,'library');};
$('export-personal').onclick=()=>localLoadFailed?exportRawStorage():download(state.personal,'personal');
$('export-backup').onclick=()=>{if(localLoadFailed)return exportRawStorage();download(backup(),'backup');if(releaseBackupFailed){backupDownloadRequested=true;refreshStorageStatus();notice('請確認下載的完整備份已保存，再按資料保存提示中的確認按鈕。');}};
let realState;
$('demo').onclick=()=>{resetBrowsing();realState=structuredClone(state);demo=true;state={library:{schemaVersion:1,complete:true,syncedAt:null,missingIds:[],games:['ASTRO BOT','Ghost of Yōtei','DEATH STRANDING 2','FINAL FANTASY VII REBIRTH','ELDEN RING','Horizon Forbidden West','God of War Ragnarök','It Takes Two'].map((name,i)=>({name,entitlementId:'demo-'+i,conceptId:'demo-concept-'+i,platform:i===7?'PS4':'PS5',membership:i%3===0?'PS_PLUS':'NONE'}))},personal:emptyPersonal()};for(const index of [4,5])state.library.games.push({...state.library.games[index],entitlementId:'demo-ps4-'+index,platform:'PS4'});state.personal.categories=['週末雙人','劇情精選','挑戰清單'];state.library.games.forEach((g,i)=>{state.personal.records[g.entitlementId]={...blankRecord(),status:['未開始','想玩','已白金','不再遊玩'][i%4],categories:i%2===0?['劇情精選']:[]};});render();notice('正在探索示範；不會寫入本機或雲端。');};
$('reset-demo').onclick=()=>{if(!demo)return;resetBrowsing();state=realState;demo=false;selected.clear();category='';view='all';render();notice('已返回你的遊戲庫。');};
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){externalChanged=true;notice('另一個分頁已更新遊戲庫。已停止此頁寫入，請先匯出此頁備份，再重新整理載入最新資料。');refreshStorageStatus();}});
render();

$('export-before-update').onclick=()=>{
 try{
  const raw=localStorage.getItem(RELEASE_BACKUP_KEY);if(!raw)return notice('這個瀏覽器沒有更新前的遊戲庫資料。');
  const saved=JSON.parse(raw),original=JSON.parse(saved.value);
  try{download({schemaVersion:1,kind:'ps-game-base-backup',exportedAt:saved.savedAt,library:library(original.library),missingIds:original.library.missingIds||[],personal:personal(original.personal),history:readHistory(original.history),storeNames:readStoreNames(original.storeNames)},'before-date-sorting');}
  catch{download(saved,'before-date-sorting-original');notice('原存檔格式無法轉換，已匯出原始資料供復原。');}
 }catch(error){notice('更新前備份匯出失敗：'+error.message);}
};

const historySync=initHistorySync({getState:()=>state,setHistory:value=>{state={...state,history:value};},save:persist,render,notice,isDemo:()=>demo,isBlocked:writesBlocked});

namesSync=initStoreNames({getState:()=>state,setNames:value=>{state={...state,storeNames:value};},save:persist,render,isBlocked:writesBlocked,isDemo:()=>demo});
unifiedSync=initUnifiedSync({historySync,getState:()=>state,isDemo:()=>demo,isBlocked:writesBlocked,notice,
 syncNames:options=>namesSync.start(options),cancelNames:()=>namesSync.cancel(),
 confirmAccount:profile=>{try{if(state.library.games.length||state.history.profile)assertCatalogAccount(state,profile);const next={...state,library:{...state.library,account:{profile,method:'user',confirmedAt:new Date().toISOString()}}};return commitState(next);}catch(error){notice(error.message);return false;}},
 saveLibrary:(raw,profile)=>{
  if(demo||writesBlocked())throw Error('目前無法儲存，請先處理資料保存提示。');
  const incoming=library(raw);if(!incoming.complete)throw Error('數位遊戲庫尚未完整讀取，未套用部分結果。');
  if(!incoming.account||incoming.account.profile.toLowerCase()!==profile.toLowerCase())throw Error('尚未在 Sony 分頁確認正確帳號。請更新整合腳本至 v0.3.8，重新整理來源頁後重試。');
  assertCatalogAccount({library:incoming,history:state.history},profile);
  if(!commitState({...state,library:mergeLibrary(state.library,incoming)}))throw Error('儲存失敗，已停止同步；請保留資料並重試。');
  resetBrowsing();selected.clear();render();return incoming.games.length;
 }
});

cloudSync=initCloudSync({
 getSnapshot:backup,isDemo:()=>demo,isBlocked:()=>writesBlocked()||storageFailed,
 isEditing:()=>cardCategoryMenu.open||customFilterMenu.open||!!unifiedSync?.busy||$('history-fetch').disabled||['editor','category-dialog','confirm-dialog','account-setup'].some(id=>$(id).open),notice,
 applySnapshot:raw=>{
  if(demo||externalChanged||storageFailed||localLoadFailed||releaseBackupFailed)throw Error('此裝置目前無法載入雲端資料，請先匯出備份。');
  const data=parseImport(raw);
  const next={library:{...data.library,missingIds:data.missingIds},personal:data.personal,history:data.history,storeNames:data.storeNames};
  if(!commitState(next,{fromCloud:true}))throw Error('雲端資料無法儲存，本機原資料保留。');
  resetBrowsing();selected.clear();page=1;if(category&&!state.personal.categories.includes(category))category='';renderCategories();render();
 }
});
