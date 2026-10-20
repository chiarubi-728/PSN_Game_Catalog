import {initUnifiedSync} from './sync-ui.js';
// PSGB_PLATFORM_SPLIT_V1
import {initHistorySync} from './history-ui.js';
import {emptyHistory,readHistory,mergeHistory,trophyStatistics} from './history.js';
import {unifiedCatalog,catalogRecordFor,catalogPlatinum,catalogView,historyRecordKey} from './catalog.js';
import {emptyStoreNames,readStoreNames,mergeStoreNames} from './store-names.js';
import {initStoreNames} from './store-names-ui.js';
import {classificationOptions, classificationFor, matchesClassification, library, personal, emptyPersonal, blankRecord, workRecordFor, hasWorkConflicts, platformGames as groupGames, needsPlatformPlatinumReview, matchesWorkFilters, mergeLibrary, parseImport} from './model.js';
import {icon} from './icons.js';

const $ = id => document.getElementById(id), KEY = 'ps-game-base.v1';
let state = {library:{schemaVersion:1,complete:false,syncedAt:null,games:[],missingIds:[]},personal:emptyPersonal(),history:emptyHistory(),storeNames:emptyStoreNames()}, view='all', category='', page=1, selected=new Set(), shown=[], pendingImport=null, demo=false;
let cloudExpected, cloudRead=false, cloudBusy=false, prepared=false;
let works = new Map(),namesSync=null,unifiedSync=null;
const exclusionSettings={unorganized:true,membership:false};
function exclusionContext(){if(category)return null;if(view==='unorganized')return 'unorganized';return view==='ps-plus'||view==='non-ps-plus'?'membership':null;}
function notice(message) { $('notice').textContent=message; $('notice').classList.add('visible'); clearTimeout(notice.timer); notice.timer=setTimeout(()=>$('notice').classList.remove('visible'),8000); }
try { const raw=localStorage.getItem(KEY); if(raw){const data=JSON.parse(raw);state={library:{...library(data.library),missingIds:Array.isArray(data.library.missingIds)?data.library.missingIds:[]},personal:personal(data.personal),history:readHistory(data.history),storeNames:readStoreNames(data.storeNames)};} } catch(e) { notice('無法載入本機資料：'+e.message+'。原始存檔未被自動覆寫，請先備份瀏覽器資料。'); }
let storageFailed=false, externalChanged=false;
function persist(){if(demo)return true;if(externalChanged){storageFailed=true;notice('另一分頁已有新版本，已停止寫入。請匯出此頁備份，再重新整理，避免覆蓋新資料。');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;return true;}catch{storageFailed=true;notice('瀏覽器儲存失敗！目前變更只在此分頁，請立即匯出備份。');return false;}}
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function option(select,value,label){const n=el('option',label??value);n.value=value;select.append(n);}
for(const item of classificationOptions){const label=el('label',undefined,'status-choice'),input=el('input'),visual=el('span',undefined,'status-option');input.type='radio';input.name='classification';input.value=item.value;visual.dataset.tone=item.tone;visual.append(icon(item.icon),el('span',item.label));label.append(input,visual);$('edit-classifications').append(label);input.onchange=()=>{if(input.checked)setEditorStatus(input.value);};}
for(const b of $('views').querySelectorAll('[data-classification]')){const item=classificationFor(b.dataset.classification);b.dataset.tone=item.tone;b.prepend(icon(item.icon));}
let editorClassificationChanged=false;
function setEditorStatus(value,initial=false){editorClassificationChanged=!initial;$('edit-status').value=value;for(const input of $('edit-classifications').querySelectorAll('input'))input.checked=input.value===value;$('legacy-status').hidden=value==='未開始'||!!classificationFor(value);$('legacy-status').textContent=`保留舊狀態「${value}」。選擇上方分類或清除分類後，才會變更原狀態。`;}
$('clear-status').onclick=()=>setEditorStatus('未開始');
function record(id){return catalogRecordFor(state.personal,works.get(id));}
function update(id,patch){const next={...record(id),...patch,updatedAt:new Date().toISOString()};if(Object.hasOwn(patch,'status'))delete next.platinumReview;state.personal.works=Object.assign(Object.create(null),state.personal.works,{[id]:next});}
function backup(){return {schemaVersion:1,kind:'ps-game-base-backup',exportedAt:new Date().toISOString(),library:library(state.library),missingIds:state.library.missingIds||[],personal:state.personal,history:readHistory(state.history),storeNames:readStoreNames(state.storeNames)};}
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=`ps-game-base-${name}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function render(){
 const games=unifiedCatalog(state.library,state.personal,state.history,state.storeNames);works=new Map(games.map(g=>[g.key,g]));
 const exclusion=exclusionContext();
 const excludeOrganized=exclusion!==null&&exclusionSettings[exclusion];
 $('exclude-organized').checked=excludeOrganized;
 $('catalog-stats').hidden=view!=='all'||!!category;
 $('membership-options').hidden=exclusion===null;
 for(const id of [...selected])if(!works.has(id)||excludeOrganized&&!catalogView(works.get(id),record(id),'unorganized'))selected.delete(id);
 $('stat-total').textContent=games.length;
 $('stat-entitlements').textContent=state.library.games.length+' 筆原始數位授權';
 const trophyStats=trophyStatistics(state.history),providerName={psnprofiles:'PSNProfiles',sony:'Sony'}[trophyStats.provider];
 $('stat-platinum').textContent=trophyStats.platinum;$('stat-platinum-label').textContent=providerName?providerName+' 白金':'已取得白金';
 $('stat-platinum-note').textContent=providerName?'依來源獎盃 ID 計數；個人標記另存':'同步遊玩紀錄後顯示來源白金數';
 $('stat-owned').textContent=games.filter(g=>g.digitalOwned).length;$('stat-played').textContent=trophyStats.played;
 $('stat-played-note').textContent=providerName?providerName+' · '+trophyStats.unfinished+' 款尚未白金'+(trophyStats.coverage==='platinum'?'（僅舊白金資料）':''):'同步來源的全部遊玩紀錄';
 const sources=Object.values(state.history?.sources||{});
 $('summary').textContent=demo?'示範模式 · 操作不會寫入你的遊戲庫':sources.length?(state.history.profile+' · 數位授權與 '+sources.map(source=>source.provider==='psnprofiles'?'PSNProfiles':'Sony').join(' / ')+' 遊玩紀錄已合併'+(storageFailed?' · 儲存失敗，請匯出備份':'')):'保留數位遊戲庫，再同步 PSNProfiles 的全部遊玩與獎盃紀錄。';
 const names={all:'所有遊戲',unorganized:'尚未整理','ps-plus':'PS Plus','non-ps-plus':'非 PS Plus',platinum:'白金',ignored:'忽略',tracked:'追蹤'};
 $('heading').replaceChildren(el('span',category?names[view]+' · '+category:names[view]),el('small',' / LIBRARY'));
 for(const b of $('views').querySelectorAll('button')){const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 const batchChoice=$('batch-category').value;
 $('categories').replaceChildren();$('batch-category').replaceChildren();option($('batch-category'),'','選擇分類');
 for(const item of classificationOptions)option($('batch-category'),'mark:'+item.value,item.value==='已白金'?'白金（個人標記）':item.label);
 for(const c of state.personal.categories){const b=el('button','◌　'+c);b.classList.toggle('active',category===c);b.onclick=()=>{category=c;if(view==='unorganized')view='all';page=1;render();};$('categories').append(b);option($('batch-category'),'category:'+c,classificationOptions.some(item=>item.label===c)?c+'（自訂）':c);}
 if([...$('batch-category').options].some(item=>item.value===batchChoice))$('batch-category').value=batchChoice;
 const filtered=games.filter(game=>{const r=record(game.key);return (!category||r.categories.includes(category))&&catalogView(game,r,view==='unorganized'?'all':view)&&(!excludeOrganized||catalogView(game,r,'unorganized'));});
 filtered.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')||a.key.localeCompare(b.key));
 const pages=Math.max(1,Math.ceil(filtered.length/48));page=Math.min(page,pages);shown=filtered.slice((page-1)*48,page*48);
 $('grid').replaceChildren();$('empty').hidden=filtered.length>0;
 $('empty').querySelector('h2').textContent=games.length?'這個分類目前沒有遊戲':'數位擁有與所有遊玩紀錄，整理在一起。';
 $('empty').querySelector('p').textContent=games.length?'可從左側選擇其他分類，或返回「所有遊戲」。':'匯入官方數位遊戲庫，或按「同步遊戲庫」更新數位授權與全部遊玩紀錄，包含尚未白金的遊戲。';
 $('empty-import').hidden=games.length>0;$('demo').hidden=games.length>0||demo;
 for(const g of shown){const id=g.key,r=record(id),card=el('article',undefined,'card'),art=el('div',undefined,'art');
  const placeholder=el('div',g.name.split(/\s/).map(s=>s[0]).slice(0,3).join(''),'cover-placeholder');art.append(placeholder);
  if(g.imageUrl){const image=el('img');image.src=g.imageUrl;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();art.append(image);}
  const check=el('input');check.type='checkbox';check.className='card-check';check.checked=selected.has(id);check.setAttribute('aria-label','選取 '+g.name+' · '+g.platforms.join(' / '));check.onchange=()=>{check.checked?selected.add(id):selected.delete(id);renderBatch();};art.append(check);
  art.append(quickClassifications(g,r.status));art.append(el('span',g.platforms.join(' · ')||'PS','platform-badge'));card.append(art);
  const body=el('div',undefined,'card-body'),title=el('button',g.name+' · '+g.platforms.join(' / '),'game-title');title.onclick=()=>edit(g);body.append(title);
  const alternate=g.names.find(name=>name!==g.name);if(alternate)body.append(el('p',alternate,'alternate-name'));
  const ownership=el('span',g.digitalOwned?'數位擁有':g.digitalMembers.length?'歷史數位授權':'遊玩紀錄','ownership-label');ownership.dataset.owned=String(g.digitalOwned);body.append(ownership);
  const item=classificationFor(g.platinum?'已白金':r.status),pill=el('span',undefined,'status-pill');
  if(item){pill.dataset.tone=item.tone;pill.append(icon(item.icon),document.createTextNode(g.platinum?item.label:r.status==='已白金'?'個人白金標記':item.label));}else pill.textContent=g.played?'尚未白金':'未分類';
  const line=el('div',undefined,'card-meta');line.append(pill,el('span',g.played?'已玩':'尚無遊玩紀錄'));body.append(line);
  if(g.played){const text=[g.progress!==null?g.progress+'%':'獎盃紀錄已同步',g.earnedTotal!==null?g.earnedTotal+(g.definedTotal!==null?' / '+g.definedTotal:'')+' 個獎盃':''].filter(Boolean).join(' · ');body.append(el('p',text,'trophy-summary'));if(g.progress!==null){const progress=el('progress');progress.max=100;progress.value=g.progress;progress.setAttribute('aria-label','獎盃進度 '+g.progress+'%');body.append(progress);}}
  body.append(el('p',g.sources.map(source=>({digital:'Sony 數位庫',psnprofiles:'PSNProfiles',sony:'Sony 獎盃'})[source]).join(' · '),'source-label'));
  if(r.categories.length||r.tags.length)body.append(el('p',[...r.categories,...r.tags.map(t=>'#'+t)].join(' · '),'tags'));
  if(g.missingCount)body.append(el('p','部分或全部數位授權未出現在最近完整同步','missing'));
  card.append(body);$('grid').append(card);
 }
 $('result-count').textContent=filtered.length+' / '+games.length+' 張遊戲／平台卡片 · '+filtered.reduce((count,g)=>count+g.digitalMembers.length,0)+' 筆數位授權'+(selected.size?' · 已選 '+selected.size+' 張':'');$('page-label').textContent=page+' / '+pages;$('prev').disabled=page===1;$('next').disabled=page===pages;renderBatch();$('reset-demo').hidden=!demo;unifiedSync?.refresh();
}
function renderBatch(){$('batch').hidden=!selected.size;$('selected-count').textContent=`已選 ${selected.size} 款遊戲`;$('apply-category').disabled=!selected.size||!$('batch-category').value;}
function quickClassifications(game,status){
 const controls=el('div',undefined,'quick-classifications');controls.setAttribute('role','radiogroup');controls.setAttribute('aria-label',game.name+' · '+game.platforms.join(' / ')+'分類');let keyboard=false;
 for(const value of ['已白金','想玩','不再遊玩']){
  const item=classificationFor(value),label=el('label',undefined,'quick-choice'),input=el('input'),visual=el('span',undefined,'quick-option');
  label.dataset.tone=item.tone;label.title=value==='已白金'?'個人白金標記（不計入來源白金數）':item.label;input.type='radio';input.name='quick-'+game.key;input.value=value;input.checked=status===value;input.dataset.workKey=game.key;input.setAttribute('aria-label',game.name+' · '+game.platforms.join(' / ')+'：'+item.label);visual.append(icon(item.icon));label.append(input,visual);controls.append(label);
  label.onpointerdown=()=>{keyboard=false;};input.onkeydown=()=>{keyboard=true;};
  const saveStatus=next=>{update(game.key,{status:next});persist();render();if(keyboard){const replacement=[...$('grid').querySelectorAll('.quick-choice input')].find(n=>n.dataset.workKey===game.key&&n.value===value);replacement?.focus();}};
  input.onclick=e=>{e.preventDefault();saveStatus(status===value?'未開始':value);};
  input.onchange=()=>{if(input.checked)saveStatus(value);};
 }
 return controls;
}
$('platform-review-show').onclick=()=>{view='all';category='';page=1;render();};
$('platform-review-sony').onclick=()=>$('history-dialog').showModal();
for(const button of $('views').querySelectorAll('button'))button.onclick=()=>{view=button.dataset.view;category='';page=1;render();};
document.querySelector('.brand').onclick=event=>{event.preventDefault();view='all';category='';page=1;render();};
$('exclude-organized').onchange=()=>{const context=exclusionContext();if(context===null)return;exclusionSettings[context]=$('exclude-organized').checked;page=1;render();};
function changePage(delta){page+=delta;render();window.scrollTo({top:0,left:0,behavior:'instant'});}
$('prev').onclick=()=>changePage(-1);$('next').onclick=()=>changePage(1);
$('select-all').onclick=()=>{shown.forEach(g=>selected.add(g.key));render();};$('clear-selection').onclick=()=>{selected.clear();render();};
$('batch-category').onchange=renderBatch;
$('apply-category').onclick=()=>{
 const choice=$('batch-category').value,ids=[...selected].filter(id=>works.has(id));if(!choice||!ids.length)return;
 const marker=choice.startsWith('mark:')?classificationFor(choice.slice(5)):null,c=choice.startsWith('category:')?choice.slice(9):null;
 if(!marker&&(!c||!state.personal.categories.includes(c)))return notice('請重新選擇分類。');
 const previous=state.personal.works;
 for(const id of ids)update(id,marker?{status:marker.value}:{categories:[...new Set([...record(id).categories,c])]});
 const saved=persist();if(!saved)state.personal.works=previous;render();
 if(saved)notice(`已將 ${ids.length} 款遊戲加入「${marker?marker.label:c}」${marker?.value==='已白金'?'（個人標記，不更動獎盃紀錄）':''}。`);
};
function edit(g){const r=record(g.key);$('edit-name').textContent=g.name+' · '+(g.platforms.join(' / ')||'未知平台');$('edit-id').value=g.key;$('edit-info').textContent=`${g.platforms.join(' · ')||'未知平台'} · ${g.digitalMembers.length} 筆數位授權 · ${g.played?'有遊玩紀錄':'尚無遊玩紀錄'} · 此平台的筆記獨立保存`;$('edit-platform-review').hidden=true;$('edit-conflicts').hidden=!hasWorkConflicts(state.personal,g);$('edit-versions').open=false;$('edit-versions').hidden=!g.digitalMembers.length;$('edit-version-list').replaceChildren();for(const m of g.digitalMembers){const item=el('p',`${m.platform||'未知平台'} · ${m.membership==='PS_PLUS'?'PS Plus':m.membership==='NONE'?'非 PS Plus':'來源未分類'}${(state.library.missingIds||[]).includes(m.entitlementId)?' · 最近同步未出現':''}`);item.append(el('small',m.productId||m.entitlementId));$('edit-version-list').append(item);}$('edit-history').replaceChildren();for(const entry of g.historyEntries){const row=el('p',entry.name+' · '+entry.platforms.join(' / ')+' · '+(entry.platinum?'已白金':'尚未白金')+(entry.progress!==null?' · '+entry.progress+'%':'')+' · '+(entry.provider==='sony'?'Sony':'PSNProfiles'));if(entry.url){const link=el('a','查看獎盃來源 ↗');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';row.append(document.createTextNode(' '),link);}const oldKey=historyRecordKey(entry),old=state.personal.works[oldKey];if(oldKey!==g.key&&old?.note&&old.note!==r.note){const note=el('span','原遊玩紀錄筆記：'+old.note,'preserve-lines');row.append(el('br'),note);}$('edit-history').append(row);}$('edit-history-section').hidden=!g.played;$('edit-official-names').textContent=(g.officialNames||[]).join(' / ');$('edit-official-section').hidden=!g.officialNames?.length;$('edit-official-links').replaceChildren();const officialUrls=new Set(g.digitalMembers.flatMap(member=>state.storeNames?.records?.[member.productId?.trim().toUpperCase()]?.sourceUrls||[]));for(const url of officialUrls){const link=el('a','Sony 官方名稱來源 ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';$('edit-official-links').append(link);}setEditorStatus(r.status,true);$('edit-note').value=r.note;$('edit-title-aliases').value=(r.titleAliases||[]).join('\n');$('edit-tags').value=r.tags.join(', ');$('edit-categories').replaceChildren();for(const c of state.personal.categories){const label=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.value=c;check.checked=r.categories.includes(c);label.append(check,document.createTextNode(c));$('edit-categories').append(label);}$('store-link').hidden=!/^[A-Z0-9_-]+$/i.test(g.productId||'');$('store-link').href='https://store.playstation.com/zh-hant-tw/product/'+encodeURIComponent(g.productId||'');$('editor').showModal();}
$('edit-form').onsubmit=e=>{e.preventDefault();const tags=[...new Set($('edit-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean))];if(tags.some(t=>t.length>100))return notice('每個標籤最多 100 字。');const titleAliases=[...new Set($('edit-title-aliases').value.split(/\r?\n/).map(name=>name.trim()).filter(Boolean))];if(titleAliases.length>50||titleAliases.some(name=>name.length>500))return notice('白金配對名稱最多 50 個，每個最多 500 字。');update($('edit-id').value,{titleAliases,...(editorClassificationChanged?{status:$('edit-status').value}:{}),note:$('edit-note').value,tags,categories:[...$('edit-categories').querySelectorAll('input:checked')].map(n=>n.value)});persist();$('editor').close();render();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('settings').onclick=()=>$('data-dialog').showModal();
$('mobile-settings').onclick=()=>$('data-dialog').showModal();
$('mobile-categories').onclick=()=>{renderCategories();$('category-dialog').showModal();};
function renderCategories(){$('category-list').replaceChildren();for(const c of state.personal.categories){const row=el('div',undefined,'category-row'),name=el('span',c),rename=el('button','重新命名'),remove=el('button','刪除');rename.onclick=()=>{const next=prompt('新分類名稱',c)?.trim();if(!next||next===c)return;if(next.length>100||state.personal.categories.includes(next))return notice('名稱過長或已存在。');state.personal.categories=state.personal.categories.map(x=>x===c?next:x);for(const r of [...Object.values(state.personal.records),...Object.values(state.personal.works)])r.categories=r.categories.map(x=>x===c?next:x);if(category===c)category=next;persist();renderCategories();render();};remove.onclick=()=>{if(!confirm(`刪除「${c}」分類？遊戲及其他整理紀錄會保留。`))return;state.personal.categories=state.personal.categories.filter(x=>x!==c);for(const r of [...Object.values(state.personal.records),...Object.values(state.personal.works)])r.categories=r.categories.filter(x=>x!==c);if(category===c)category='';persist();renderCategories();render();};row.append(name,rename,remove);$('category-list').append(row);}}
$('manage-categories').onclick=()=>{renderCategories();$('category-dialog').showModal();};$('category-form').onsubmit=e=>{e.preventDefault();const c=$('category-name').value.trim();if(!c||state.personal.categories.includes(c))return notice('分類名稱不可空白或重複。');state.personal.categories.push(c);$('category-name').value='';persist();renderCategories();render();};
function preview(data,source){
 if(data.history&&state.history?.profile&&data.history.profile&&state.history.profile.toLowerCase()!==data.history.profile.toLowerCase())throw Error('遊玩紀錄屬於不同帳號，未合併。');
 pendingImport={data,source};$('import-preview').textContent=source+'：'+(data.library?data.library.games.length+' 筆數位授權，合併更新。':'')+(data.history?Object.values(data.history.sources).reduce((count,snapshot)=>count+snapshot.games.length,0)+' 筆遊玩來源紀錄，合併更新。':'')+(data.storeNames?Object.keys(data.storeNames.records).length+' 個官方商品名稱對照，合併更新。':'')+(data.personal?'個人整理將整份取代。':'個人筆記與分類保留。');$('confirm-dialog').showModal();
}
 $('import').onclick=$('empty-import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>15*1024*1024)throw Error('JSON 檔案上限為 15 MB。');preview(parseImport(JSON.parse(await file.text())),file.name);}catch(e){notice('匯入失敗：'+e.message);}finally{$('file').value='';}};
 $('confirm-import').onclick=()=>{if(!pendingImport)return;const previous=state;try{const {data}=pendingImport,next=structuredClone(state);if(data.library){next.library=mergeLibrary(next.library,data.library);if(data.missingIds)next.library.missingIds=data.missingIds.filter(id=>next.library.games.some(g=>g.entitlementId===id));}if(data.personal)next.personal=data.personal;if(data.history)for(const snapshot of Object.values(data.history.sources))next.history=mergeHistory(next.history,snapshot);if(data.storeNames)next.storeNames=mergeStoreNames(next.storeNames,data.storeNames);state=next;if(!persist()){state=previous;return;}selected.clear();category='';page=1;render();pendingImport=null;$('confirm-dialog').close();notice('已合併遊戲資料；個人整理依預覽處理。');}catch(error){state=previous;notice('匯入失敗：'+error.message);}};
$('export-library').onclick=()=>{const value=library(state.library),missing=new Set(state.library.missingIds||[]);value.games=value.games.filter(g=>!missing.has(g.entitlementId));download(value,'library');};$('export-personal').onclick=()=>download(state.personal,'personal');$('export-backup').onclick=()=>download(backup(),'backup');
const auth=new window.SideProjectAuth.GoogleAuth('260923931716-cevi1vcfrfoibmn3i2fdpsn1epg7hr3g.apps.googleusercontent.com',renderCloud),drive=new window.SideProjectDrive.DriveAppData(auth,'ps-game-base.json');
function renderCloud(){const connected=auth?.connected;for(const id of ['cloud-read','cloud-write','cloud-disconnect'])$(id).disabled=!connected||cloudBusy;$('cloud-connect').disabled=cloudBusy||connected;$('cloud-connect').textContent=prepared?'連接 Google Drive':'載入 Google 授權服務';$('cloud-state').textContent=connected?`已授權 · ${cloudRead?'已讀取雲端版本，可以上傳':'請先下載確認雲端版本'}`:'尚未連接或授權已過期。';}
async function cloudAction(action){if(demo)return notice('示範模式不執行雲端同步。');cloudBusy=true;renderCloud();try{await action();}catch(e){notice(e.message);}finally{cloudBusy=false;renderCloud();}}
$('cloud-connect').onclick=()=>cloudAction(async()=>{if(!prepared){await auth.prepare();prepared=true;notice('授權服務已就緒，請再次點擊「連接 Google Drive」。');}else{await auth.connect();cloudRead=false;cloudExpected=undefined;}});
$('cloud-disconnect').onclick=()=>{auth.disconnect();cloudRead=false;cloudExpected=undefined;renderCloud();};
$('cloud-read').onclick=()=>cloudAction(async()=>{const result=await drive.read();if(!result){cloudExpected=null;cloudRead=true;return notice('雲端尚無備份，可以上傳本機資料。');}const data=parseImport(result.value);if(!data.personal||!data.library)throw Error('雲端檔案不是完整遊戲庫備份。');cloudExpected=result;cloudRead=true;preview(data,'Google Drive');});
$('cloud-write').onclick=()=>cloudAction(async()=>{if(!cloudRead)throw Error('請先下載並預覽，確認雲端版本後再上傳。');if(!confirm('將目前本機完整備份上傳至 Google Drive？雲端舊內容將被取代。'))return;const value=backup();if(new Blob([JSON.stringify(value)]).size>5*1024*1024)throw Error('備份超過 5 MB，請改用本機 JSON 匯出。');await drive.write(value,cloudExpected);cloudRead=false;cloudExpected=undefined;notice('已上傳備份；再次上傳前請重新下載確認版本。');});
let realState;
$('demo').onclick=()=>{realState=structuredClone(state);demo=true;state={library:{schemaVersion:1,complete:true,syncedAt:null,missingIds:[],games:['ASTRO BOT','Ghost of Yōtei','DEATH STRANDING 2','FINAL FANTASY VII REBIRTH','ELDEN RING','Horizon Forbidden West','God of War Ragnarök','It Takes Two'].map((name,i)=>({name,entitlementId:'demo-'+i,conceptId:'demo-concept-'+i,platform:i===7?'PS4':'PS5',membership:i%3===0?'PS_PLUS':'NONE'}))},personal:emptyPersonal()};for(const index of [4,5])state.library.games.push({...state.library.games[index],entitlementId:'demo-ps4-'+index,platform:'PS4'});state.personal.categories=['週末雙人','劇情精選','挑戰清單'];state.library.games.forEach((g,i)=>{state.personal.records[g.entitlementId]={...blankRecord(),status:['未開始','想玩','已白金','不再遊玩'][i%4],categories:i%2===0?['劇情精選']:[]};});render();notice('正在探索示範；不會寫入本機或雲端。');};
$('reset-demo').onclick=()=>{if(!demo)return;state=realState;demo=false;selected.clear();category='';view='all';render();notice('已返回你的遊戲庫。');};
window.addEventListener('storage',event=>{if(event.key===KEY){externalChanged=true;notice('另一個分頁已更新遊戲庫。已停止此頁寫入，請先匯出此頁備份，再重新整理載入最新資料。');}});
render();renderCloud();

const historySync=initHistorySync({getState:()=>state,setHistory:value=>{state.history=value;},save:persist,render,notice,isDemo:()=>demo,isBlocked:()=>externalChanged});

namesSync=initStoreNames({getState:()=>state,setNames:value=>{state.storeNames=value;},save:persist,render,isBlocked:()=>externalChanged,isDemo:()=>demo});
unifiedSync=initUnifiedSync({historySync,getState:()=>state,isDemo:()=>demo,isBlocked:()=>externalChanged,notice,
 syncNames:options=>namesSync.start(options),cancelNames:()=>namesSync.cancel(),
 saveLibrary:raw=>{if(demo||externalChanged)throw Error('目前無法儲存，請重新整理後再同步。');const incoming=library(raw);if(!incoming.complete)throw Error('數位遊戲庫尚未完整讀取，未套用部分結果。');const previous=state.library;state.library=mergeLibrary(previous,incoming);if(!persist()){state.library=previous;throw Error('儲存失敗，已停止同步；請先匯出備份。');}render();return incoming.games.length;}
});
