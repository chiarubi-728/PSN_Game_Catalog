import {platformGames,workRecordFor,personalPlatinum} from './model.js';
import {gameTitleId} from './sony-platinums.js';
import {titleMatch} from './title-aliases.js';
import {officialNamesFor} from './store-names.js';
import {localizeCatalogNames} from './catalog-display-names.js';
import {groupVerifiedEditions} from './catalog-editions.js';
import {historyRecordKey as historyKey} from './catalog-personal.js';
export {catalogRecordFor,catalogRecordNotes} from './catalog-personal.js';
const platformKey=game=>game.platforms.join('/');
export {historyKey as historyRecordKey};
const regionFor=g=>({UP:'NA',EP:'EU',JP:'JP',HP:'AS'})[/^([A-Z]{2})\d/.exec(g.productId||'')?.[1]];
function recordMembers(work){return [...work.members,...(work.officialNames||[]).map(name=>({name})),...work.historyEntries.map(entry=>({name:entry.name}))];}
function matchesName(work,entry,personal){return platformKey(work)===platformKey(entry)&&(!entry.region||!work.digitalMembers.length||work.digitalMembers.some(g=>regionFor(g)===entry.region))&&titleMatch({...work,members:recordMembers(work)},entry.name,workRecordFor(personal,work));}
export function unifiedCatalog(library,personal,history,storeNames){
  const missing=new Set(library.missingIds||[]);
  const cards=groupVerifiedEditions(platformGames(library.games,library.missingIds).map(work=>({...work,officialNames:officialNamesFor(work,storeNames),digitalMembers:work.members,digitalOwned:work.members.some(g=>!missing.has(g.entitlementId)),historyEntries:[],played:false,platinum:false})));
  const byTitleId=new Map();
  for(const card of cards)for(const member of card.members){const id=gameTitleId(member);if(id){if(!byTitleId.has(id))byTitleId.set(id,new Set());byTitleId.get(id).add(card);}}
  const direct=new Map();
  for(const row of history?.sources?.sony?.mappings||[])for(const id of row.trophyIds){if(!direct.has(id))direct.set(id,new Set());for(const card of byTitleId.get(row.titleId)||[])if(card.platforms.includes(row.platform))direct.get(id).add(card);}
  for(const provider of ['sony','psnprofiles']){
    const entries=(history?.sources?.[provider]?.games||[]).map(game=>({...game,provider}));
    for(const entry of entries){
      let target;
      const ids=provider==='sony'?[...(direct.get(entry.id)||[])].filter(card=>platformKey(card)===platformKey(entry)):[];
      if(ids.length===1)target=ids[0];
      if(!target&&ids.length===0){
        const candidates=cards.filter(card=>!card.historyEntries.some(other=>other.provider===provider)&&matchesName(card,entry,personal));
        // Multiple regional trophy stacks stay visible as separate records.
        if(candidates.length===1&&entries.filter(other=>matchesName(candidates[0],other,personal)).length===1)target=candidates[0];
      }
      if(!target){
        const platform=platformKey(entry),member={name:entry.name,platform,entitlementId:historyKey(entry)};
        target={...member,key:historyKey(entry),members:[member],platforms:entry.platforms,digitalMembers:[],digitalOwned:false,historyEntries:[],missingCount:0};cards.push(target);
      }
      target.historyEntries.push(entry);target.played=true;target.platinum=target.platinum||entry.platinum;
      if(!target.imageUrl&&entry.imageUrl)target.imageUrl=entry.imageUrl;
    }
  }
  const sourceRanks=new Map();
  for(const provider of ['psnprofiles','sony'])for(const [index,game] of (history?.sources?.[provider]?.games||[]).entries())sourceRanks.set(provider+':'+game.id,index+(provider==='sony'?100000:0));
  return localizeCatalogNames(cards.map(card=>{
    // Sony is the primary progress source when both providers report a set.
    const preferred=card.historyEntries.find(entry=>entry.provider==='sony'&&entry.progress!==null)||card.historyEntries.find(entry=>entry.progress!==null)||card.historyEntries[0];
    const ranks=card.historyEntries.map(entry=>sourceRanks.get(entry.provider+':'+entry.id)).filter(Number.isFinite);
    return {...card,sourceOrder:ranks.length?Math.min(...ranks):null,progress:preferred?.progress??null,earnedTotal:preferred?.earnedTotal??null,definedTotal:preferred?.definedTotal??null,names:[...new Set([...card.members.map(g=>g.name),...(card.officialNames||[]),...card.historyEntries.map(g=>g.name)])],sources:[...(card.digitalMembers.length?['digital']:[]),...new Set(card.historyEntries.map(g=>g.provider))]};
  }),storeNames);
}
export const catalogPlatinum=work=>work.platinum===true;
export function catalogView(work,record,view,{includeIgnored=false}={}){
  // Other views expose ignored games only when explicitly requested by filter.
  if(record.status==='不再遊玩'&&(view==='ignored'||!includeIgnored))return view==='ignored';
  if(view==='ignored')return false;
  if(view==='ps-plus')return work.digitalMembers.some(member=>member.membership==='PS_PLUS');
  if(view==='non-ps-plus')return work.digitalMembers.some(member=>member.membership==='NONE');
  if(view==='unorganized')return !catalogPlatinum(work)&&!personalPlatinum(record)&&record.status==='未開始'&&record.categories.length===0;
  if(view==='digital')return work.digitalOwned;
  if(view==='played')return work.played;
  if(view==='unfinished')return work.played&&!catalogPlatinum(work,record);
  if(view==='history-only')return work.played&&!work.digitalOwned;
  if(view==='platinum')return catalogPlatinum(work)||personalPlatinum(record);
  if(view==='missing')return work.missingCount>0;
  if(view==='tracked')return record.status==='想玩';
  return true;
}
