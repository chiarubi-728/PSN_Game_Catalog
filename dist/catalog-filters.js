import {classificationFor} from './model.js';
const controls=['search','platform','completion','ownership','status','sort','progress-min','progress-max'];
const storageKey='ps-game-base.filters.v1';
export function readCatalogFilters(root=document){
  const value=id=>root.getElementById(id).value;
  const rawMin=value('progress-min').trim(),rawMax=value('progress-max').trim();
  const min=rawMin===''?null:Number(rawMin),max=rawMax===''?null:Number(rawMax);
  const invalidRange=[min,max].some(number=>number!==null&&(!Number.isFinite(number)||number<0||number>100))||min!==null&&max!==null&&min>max;
  return {search:value('search').trim().toLocaleLowerCase(),platform:value('platform'),completion:value('completion'),ownership:value('ownership'),status:value('status'),sort:value('sort'),min,max,invalidRange};
}
function completionMatches(game,value){
  if(value==='platinum')return game.platinum;
  if(value==='not-platinum')return game.played&&!game.platinum;
  if(value==='incomplete')return game.played&&game.progress!==null&&game.progress<100;
  if(value==='no-progress')return !game.played||game.progress===null||game.progress===0;
  return true;
}
function ownershipMatches(game,value){
  if(value==='digital')return game.digitalOwned;
  if(value==='history-only')return game.played&&!game.digitalOwned;
  return true;
}
function personalMatches(record,value){
  if(value==='unclassified')return !classificationFor(record.status);
  if(value==='exclude-ignored')return record.status!=='不再遊玩';
  if(value==='manual-platinum')return record.status==='已白金';
  return !value||record.status===value;
}
export function matchesCatalogFilters(game,record,filters){
  if(filters.invalidRange)return false;
  if(filters.platform&&!game.platforms.includes(filters.platform))return false;
  if(!completionMatches(game,filters.completion)||!ownershipMatches(game,filters.ownership)||!personalMatches(record,filters.status))return false;
  if((filters.min!==null||filters.max!==null)&&(game.progress===null||filters.min!==null&&game.progress<filters.min||filters.max!==null&&game.progress>filters.max))return false;
  return !filters.search||[...game.names,...(record.titleAliases||[]),record.note,...record.tags].join(' ').toLocaleLowerCase().includes(filters.search);
}
function nullableNumbers(a,b,direction){
  const hasA=typeof a==='number'&&Number.isFinite(a),hasB=typeof b==='number'&&Number.isFinite(b);
  if(!hasA||!hasB)return hasA?-1:hasB?1:0;
  return direction*(a-b);
}
export function compareCatalogGames(a,b,sort,recordFor){
  let result=0;
  if(sort==='progress-high'||sort==='progress-low')result=nullableNumbers(a.progress,b.progress,sort==='progress-high'?-1:1);
  if(sort==='earned-high'||sort==='earned-low')result=nullableNumbers(a.earnedTotal,b.earnedTotal,sort==='earned-high'?-1:1);
  if(sort==='source-order')result=nullableNumbers(a.sourceOrder,b.sourceOrder,1);
  if(sort==='updated')result=recordFor(b).updatedAt.localeCompare(recordFor(a).updatedAt);
  return result||(sort==='name-desc'?-1:1)*a.name.localeCompare(b.name,'zh-Hant')||a.key.localeCompare(b.key);
}
export function saveCatalogFilters({view,category},root=document){
  try{sessionStorage.setItem(storageKey,JSON.stringify({schemaVersion:1,view,category,panelOpen:root.getElementById('filter-panel').open,advancedOpen:root.getElementById('filter-advanced').open,values:Object.fromEntries(controls.map(id=>[id,root.getElementById(id).value]))}));}catch{}
}
export function restoreCatalogFilters(personal,root=document){
  try{
    const data=JSON.parse(sessionStorage.getItem(storageKey));
    if(data?.schemaVersion!==1||!data.values||typeof data.values!=='object')return {view:'all',category:''};
    if(typeof data.panelOpen==='boolean')root.getElementById('filter-panel').open=data.panelOpen;
    if(typeof data.advancedOpen==='boolean')root.getElementById('filter-advanced').open=data.advancedOpen;
    for(const id of controls){let value=data.values[id];const control=root.getElementById(id);if(typeof value!=='string'||value.length>500)continue;if(id==='completion'&&['zero','unplayed','unknown'].includes(value))value='no-progress';if(control.tagName==='SELECT'&&![...control.options].some(option=>option.value===value))continue;control.value=value;}
    if(readCatalogFilters(root).invalidRange)for(const id of ['progress-min','progress-max'])root.getElementById(id).value='';
    const views=new Set(['all','platinum','ignored','tracked']);
    return {view:views.has(data.view)?data.view:'all',category:personal.categories.includes(data.category)?data.category:''};
  }catch{return {view:'all',category:''};}
}
export function resetCatalogControls(root=document){
  for(const id of controls)root.getElementById(id).value=id==='sort'?'name':'';
}
