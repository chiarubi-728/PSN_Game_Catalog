import {classificationFor} from './model.js';
const storageKey='ps-game-base.filters.v1';
const sides=['include','exclude'];
const fields={include:{search:'search',min:'progress-min',max:'progress-max'},exclude:{search:'exclude-search',min:'exclude-progress-min',max:'exclude-progress-max'}};
function definitions(personal){return [
  {id:'platform',label:'平台',options:[['PS5','PS5'],['PS4','PS4'],['PS3','PS3'],['PSVITA','PS Vita']]},
  {id:'completion',label:'完成狀態',options:[['platinum','已白金'],['not-platinum','未白金'],['incomplete','未 100%'],['no-progress','尚無遊玩進度']]},
  {id:'ownership',label:'遊戲來源',options:[['digital','數位擁有'],['history-only','非數位擁有（僅有遊玩紀錄）']]},
  {id:'status',label:'個人標記',options:[['manual-platinum','白金（個人標記）'],['不再遊玩','忽略'],['想玩','追蹤'],['unclassified','未分類']]},
  {id:'category',label:'自訂分類',options:personal.categories.map(name=>[name,name])}
];}
function inputs(root,side){return [...root.querySelectorAll('#filter-'+side+'-options input[data-facet]')];}
function selected(root,side){const result={};for(const input of inputs(root,side))if(input.checked)(result[input.dataset.facet]??=[]).push(input.value);return result;}
export function renderCatalogFilterOptions(personal,root=document){
  const signature=JSON.stringify(personal.categories);
  for(const side of sides){
    const container=root.getElementById('filter-'+side+'-options');if(container.dataset.signature===signature)continue;
    const previous=selected(root,side);container.replaceChildren();
    for(const facet of definitions(personal)){
      const group=root.createElement('fieldset'),legend=root.createElement('legend'),list=root.createElement('div');legend.textContent=facet.label;group.append(legend,list);list.className='filter-multi-options';
      for(const [value,label] of facet.options){const choice=root.createElement('label'),input=root.createElement('input'),text=root.createElement('span');input.type='checkbox';input.dataset.facet=facet.id;input.dataset.filterSide=side;input.value=value;input.checked=previous[facet.id]?.includes(value)===true;input.setAttribute('aria-label',(side==='include'?'包含':'排除')+facet.label+'：'+label);text.textContent=label;choice.append(input,text);list.append(choice);}
      if(!facet.options.length){const empty=root.createElement('small');empty.textContent='尚未建立自訂分類';list.append(empty);}
      container.append(group);
    }
    container.dataset.signature=signature;
  }
}
function range(root,side){
  const rawMin=root.getElementById(fields[side].min).value,rawMax=root.getElementById(fields[side].max).value;
  const min=rawMin===''?null:Number(rawMin),max=rawMax===''?null:Number(rawMax);
  const invalid=[min,max].some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>100))||min!==null&&max!==null&&min>max;
  return {min,max,invalid};
}
export function readCatalogFilters(root=document){
  const includeRange=range(root,'include'),excludeRange=range(root,'exclude');
  return {include:selected(root,'include'),exclude:selected(root,'exclude'),search:root.getElementById('search').value.trim().toLocaleLowerCase(),excludeSearch:root.getElementById('exclude-search').value.trim().toLocaleLowerCase(),sort:root.getElementById('sort').value,min:includeRange.min,max:includeRange.max,excludeMin:excludeRange.min,excludeMax:excludeRange.max,invalidIncludeRange:includeRange.invalid,invalidExcludeRange:excludeRange.invalid,invalidRange:includeRange.invalid||excludeRange.invalid};
}
function completionMatches(game,value){
  if(value==='platinum')return game.platinum;
  if(value==='not-platinum')return game.played&&!game.platinum;
  if(value==='incomplete')return game.played&&game.progress!==null&&game.progress<100;
  if(value==='no-progress')return !game.played||game.progress===null||game.progress===0;
  return false;
}
function facetMatches(game,record,facet,value){
  if(facet==='platform')return game.platforms.includes(value);
  if(facet==='completion')return completionMatches(game,value);
  if(facet==='ownership')return value==='digital'?game.digitalOwned:value==='history-only'&&game.played&&!game.digitalOwned;
  if(facet==='status')return value==='unclassified'?!classificationFor(record.status):value==='manual-platinum'?record.status==='已白金':record.status===value;
  if(facet==='category')return record.categories.includes(value);
  return false;
}
function inRange(game,min,max){return game.progress!==null&&(min===null||game.progress>=min)&&(max===null||game.progress<=max);}
export function matchesCatalogFilters(game,record,filters){
  if(filters.invalidRange)return false;
  // Include: OR within a facet, AND between facets. Any exclusion wins.
  for(const [facet,values] of Object.entries(filters.include))if(values.length&&!values.some(value=>facetMatches(game,record,facet,value)))return false;
  for(const [facet,values] of Object.entries(filters.exclude))if(values.some(value=>facetMatches(game,record,facet,value)))return false;
  const text=[...game.names,...(record.titleAliases||[]),record.note,...record.tags].join(' ').toLocaleLowerCase();
  if(filters.search&&!text.includes(filters.search)||filters.excludeSearch&&text.includes(filters.excludeSearch))return false;
  if((filters.min!==null||filters.max!==null)&&!inRange(game,filters.min,filters.max))return false;
  if((filters.excludeMin!==null||filters.excludeMax!==null)&&inRange(game,filters.excludeMin,filters.excludeMax))return false;
  return true;
}
function nullableNumbers(a,b,direction){const hasA=typeof a==='number'&&Number.isFinite(a),hasB=typeof b==='number'&&Number.isFinite(b);if(!hasA||!hasB)return hasA?-1:hasB?1:0;return direction*(a-b);}
export function compareCatalogGames(a,b,sort,recordFor){
  let result=0;
  if(sort==='progress-high'||sort==='progress-low')result=nullableNumbers(a.progress,b.progress,sort==='progress-high'?-1:1);
  if(sort==='earned-high'||sort==='earned-low')result=nullableNumbers(a.earnedTotal,b.earnedTotal,sort==='earned-high'?-1:1);
  if(sort==='source-order')result=nullableNumbers(a.sourceOrder,b.sourceOrder,1);
  if(sort==='updated')result=recordFor(b).updatedAt.localeCompare(recordFor(a).updatedAt);
  return result||(sort==='name-desc'?-1:1)*a.name.localeCompare(b.name,'zh-Hant')||a.key.localeCompare(b.key);
}
export function clearCatalogFilterGroup(side,root=document){for(const input of inputs(root,side))input.checked=false;for(const id of Object.values(fields[side]))root.getElementById(id).value='';}
export function resetCatalogControls(root=document){for(const side of sides)clearCatalogFilterGroup(side,root);root.getElementById('sort').value='name';}
export function saveCatalogFilters({view,category},root=document){
  try{sessionStorage.setItem(storageKey,JSON.stringify({schemaVersion:2,view,category,panelOpen:root.getElementById('filter-panel').open,bucketOpen:Object.fromEntries(sides.map(side=>[side,root.getElementById('filter-'+side).open])),include:selected(root,'include'),exclude:selected(root,'exclude'),values:Object.fromEntries(['sort',...Object.values(fields.include),...Object.values(fields.exclude)].map(id=>[id,root.getElementById(id).value]))}));}catch{}
}
export function restoreCatalogFilters(personal,root=document){
  try{
    const data=JSON.parse(sessionStorage.getItem(storageKey));if(![1,2].includes(data?.schemaVersion)||!data.values||typeof data.values!=='object')return {view:'all',category:''};
    if(typeof data.panelOpen==='boolean')root.getElementById('filter-panel').open=data.panelOpen;
    for(const side of sides)if(typeof data.bucketOpen?.[side]==='boolean')root.getElementById('filter-'+side).open=data.bucketOpen[side];
    const chosen={include:{},exclude:{}},values={...data.values};
    if(data.schemaVersion===2){chosen.include=data.include||{};chosen.exclude=data.exclude||{};}
    else{
      for(const facet of ['platform','completion','ownership','status','category']){
        let value=facet==='category'?data.category:data.values[facet];if(typeof value!=='string'||!value)continue;
        let exclude=data.excluded?.[facet==='category'?'category-filter':facet]===true;
        if(facet==='completion'&&['zero','unplayed','unknown'].includes(value))value='no-progress';
        if(facet==='status'&&value==='exclude-ignored'){value='不再遊玩';exclude=true;}
        chosen[exclude?'exclude':'include'][facet]=[value];
      }
      if(data.excluded?.search){values['exclude-search']=values.search;values.search='';}
      if(data.excluded?.['progress-range']){values['exclude-progress-min']=values['progress-min'];values['exclude-progress-max']=values['progress-max'];values['progress-min']=values['progress-max']='';}
    }
    for(const id of ['sort',...Object.values(fields.include),...Object.values(fields.exclude)]){
      const value=values[id],control=root.getElementById(id);if(typeof value!=='string'||value.length>500)continue;if(control.tagName==='SELECT'&&![...control.options].some(option=>option.value===value))continue;control.value=value;
    }
    for(const side of sides)for(const input of inputs(root,side))input.checked=Array.isArray(chosen[side]?.[input.dataset.facet])&&chosen[side][input.dataset.facet].includes(input.value);
    for(const side of sides)if(range(root,side).invalid)for(const key of ['min','max'])root.getElementById(fields[side][key]).value='';
    const views=new Set(['all','unorganized','ps-plus','non-ps-plus','platinum','ignored','tracked']);
    return {view:views.has(data.view)?data.view:'all',category:data.schemaVersion===2&&personal.categories.includes(data.category)?data.category:''};
  }catch{return {view:'all',category:''};}
}
