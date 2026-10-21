import {blankRecord,workRecordFor,platformWorkKey,personalPlatinum} from './model.js';

const platformKey=entry=>entry.platforms.join('/');
export const historyRecordKey=entry=>'played:'+entry.provider+':'+entry.id+':'+encodeURIComponent(platformKey(entry));
const scoped=key=>key.startsWith('platform:')||key.startsWith('played:');
const indexes=new WeakMap();
function linkIndex(works){
  if(indexes.has(works))return indexes.get(works);
  const index=new Map();
  for(const [id,record] of Object.entries(works))for(const key of record.linkedKeys||[]){if(!index.has(key))index.set(key,[]);index.get(key).push({id,record});}
  indexes.set(works,index);return index;
}
function contributions(personal,work){
  if(!work)return {rows:[],keys:[]};
  const keys=new Set([work.key,...(work.sourceWorkKeys||[]),...(work.historyEntries||[]).map(historyRecordKey)]);
  for(const member of work.members){
    const platform=member.platform?.trim().toUpperCase()||'';
    keys.add(platformWorkKey('entitlement:'+member.entitlementId,platform));
    if(member.productId?.trim())keys.add(platformWorkKey('product:'+member.productId.trim(),platform));
  }
  const rows=new Map(),index=linkIndex(personal.works);
  // Expand remembered identities so edits also survive a later split/re-pair.
  for(const key of keys){
    if(Object.hasOwn(personal.works,key))rows.set(key,{id:key,record:personal.works[key]});
    for(const row of index.get(key)||[])rows.set(row.id,row);
    for(const row of rows.values()){if(scoped(row.id))keys.add(row.id);for(const linked of row.record.linkedKeys||[])keys.add(linked);}
  }
  for(const source of work.sourceWorks||[work]){
    const inherited=workRecordFor(personal,source);
    // Attribute inherited legacy data to its source card. An explicit merged
    // edit covers that scoped key, so cleared legacy markers stay cleared.
    if(![...rows.values()].some(row=>row.record===inherited))rows.set(source.key,{id:source.key,record:inherited});
  }
  return {rows:[...rows.values()],keys:[...keys].filter(scoped)};
}
const newer=(a,b)=>b.record.updatedAt.localeCompare(a.record.updatedAt)||a.id.localeCompare(b.id);
export function catalogRecordFor(personal,work){
  const {rows,keys}=contributions(personal,work);if(!rows.length)return blankRecord();
  const ordered=rows.sort(newer);
  let active=ordered.filter(row=>!ordered.some(other=>other!==row&&(other.record.linkedKeys||[]).includes(row.id)&&(!(row.record.linkedKeys||[]).includes(other.id)||newer(other,row)<0)));
  if(!active.length)active=[ordered[0]];
  const records=active.map(row=>row.record),base=records[0];
  const markers=active.filter(row=>row.record.status!=='未開始'||row.record.statusUpdatedAt).sort((a,b)=>(b.record.statusUpdatedAt||b.record.updatedAt).localeCompare(a.record.statusUpdatedAt||a.record.updatedAt)||a.id.localeCompare(b.id));
  // An unresolved ignore wins over other independent markers. A later explicit
  // edit covers its linked source records, so clearing ignore stays cleared.
  const marker=markers.find(row=>row.record.status==='不再遊玩')?.record||markers[0]?.record;
  const union=field=>[...new Set(records.flatMap(record=>record[field]||[]))];
  const merged={...base,status:marker?.status||'未開始',note:records.find(record=>record.note)?.note||'',categories:union('categories'),tags:union('tags'),titleAliases:union('titleAliases'),linkedKeys:keys};
  if(records.some(record=>record.manualPlatinum!==undefined||record.status==='已白金'))merged.manualPlatinum=records.some(personalPlatinum);
  if(marker?.statusUpdatedAt)merged.statusUpdatedAt=marker.statusUpdatedAt;else delete merged.statusUpdatedAt;
  if(merged.status!=='未開始')delete merged.platinumReview;
  return merged;
}
export function catalogRecordNotes(personal,work){
  const seen=new Set();return contributions(personal,work).rows.sort(newer).filter(row=>{const text=row.record.note;if(!text||seen.has(text))return false;seen.add(text);return true;}).map(row=>({key:row.id,note:row.record.note}));
}
