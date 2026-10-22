// Explicit associations live in personal data; source records stay untouched.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const platforms=new Set(['PS3','PS4','PS5','PSVITA','PC']);
export const historyLinkKey=(provider,id)=>JSON.stringify([provider,String(id)]);
export function readHistoryLinks(raw){
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>5000)throw Error('遊玩配對設定格式不正確。');
  const seen=new Set(),claimed=new Set();
  return raw.map(link=>{
    if(!object(link)||!['sony','psnprofiles'].includes(link.provider)||typeof link.id!=='string'||!(link.provider==='sony'?/^trophy2?:NPWR\d{1,10}_\d{2}$/:/^\d{1,10}$/).test(link.id)||typeof link.updatedAt!=='string'||!Number.isFinite(Date.parse(link.updatedAt)))throw Error('遊玩配對的來源識別不正確。');
    const key=historyLinkKey(link.provider,link.id);if(seen.has(key))throw Error('遊玩紀錄含重複的配對設定。');seen.add(key);
    let target=null;
    if(link.target!==null){
      const value=link.target;
      if(!object(value)||!platforms.has(value.platform)||!Array.isArray(value.entitlementIds)||!value.entitlementIds.length||value.entitlementIds.length>1000||value.entitlementIds.some(id=>typeof id!=='string'||!id.trim()||id.length>2000)||new Set(value.entitlementIds).size!==value.entitlementIds.length)throw Error('遊玩配對的數位遊戲識別不正確。');
      target={platform:value.platform,entitlementIds:[...value.entitlementIds].sort()};
      for(const id of target.entitlementIds){const slot=JSON.stringify([link.provider,target.platform,id]);if(claimed.has(slot))throw Error('同一數位遊戲不能配對多筆相同來源的遊玩紀錄。');claimed.add(slot);}
    }
    return {provider:link.provider,id:link.id,target,updatedAt:new Date(link.updatedAt).toISOString()};
  }).sort((a,b)=>historyLinkKey(a.provider,a.id).localeCompare(historyLinkKey(b.provider,b.id)));
}
export function historyEntries(history){
  return ['sony','psnprofiles'].flatMap(provider=>(history?.sources?.[provider]?.games||[]).map(entry=>({...entry,id:String(entry.id),provider})));
}
export function targetForCard(card){
  if(card?.platforms?.length!==1||!card.digitalMembers?.length)throw Error('請從數位版的單一平台卡片選擇配對。');
  return {platform:card.platforms[0],entitlementIds:[...new Set(card.digitalMembers.map(game=>game.entitlementId))].sort()};
}
export const cardMatchesTarget=(card,target)=>!!target&&card.platforms.length===1&&card.platforms[0]===target.platform&&card.digitalMembers.some(game=>target.entitlementIds.includes(game.entitlementId));
export const canPairHistory=(card,entry)=>!!card?.digitalMembers?.length&&card.platforms.length===1&&entry.platforms.includes(card.platforms[0]);
export const digitalRegions=card=>[...new Set(card.digitalMembers.map(game=>({UP:'NA',EP:'EU',JP:'JP',HP:'AS'})[/^([A-Z]{2})\d/.exec(game.productId||'')?.[1]]).filter(Boolean))];

export function historyLinkPlan(cards,personal){
  const decisions=new Map(),slots=new Map();
  for(const link of personal.historyLinks||[]){
    const matches=link.target?cards.filter(card=>cardMatchesTarget(card,link.target)):[];
    const card=matches.length===1?matches[0]:null;
    decisions.set(historyLinkKey(link.provider,link.id),{link,card});
    if(card){const slot=historyLinkKey(link.provider,card.key);slots.set(slot,(slots.get(slot)||0)+1);}
  }
  return {decisions,slots};
}

// Manual associations do not permanently join the two personal-note graphs.
// This also fences old linkedKeys when an automatic match is later separated.
export function historyPersonalScope(personal,work){
  const prefixes=(personal.historyLinks||[]).map(link=>'played:'+link.provider+':'+link.id+':');
  const own=prefixes.find(prefix=>work.key.startsWith(prefix));
  return key=>own?key.startsWith(own):!prefixes.some(prefix=>key.startsWith(prefix));
}
