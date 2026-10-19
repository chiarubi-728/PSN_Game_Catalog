import {platformGames as groupGames,workRecordFor,hasWorkConflicts} from './model.js';
import {titleMatch} from './title-aliases.js';
const idPattern=/^(CUSA|PPSA)\d{5}_\d{2}$/;
const trophyKey=t=>t.npServiceName+':'+t.npCommunicationId;
export function sonyProfile(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,32}$/.test(value.trim()))throw Error('請填入 PSN 帳號，例如 chiarubi。');return value.trim();}
function canonical(value){const id=typeof value==='string'?value.trim().toUpperCase():'';return /^(CUSA|PPSA)\d{5}$/.test(id)?id+'_00':idPattern.test(id)?id:null;}
export function gameTitleId(game){
  const title=canonical(game.titleId),product=canonical(/(?:^|-)((?:CUSA|PPSA)\d{5}_\d{2})(?:-|$)/.exec(game.productId||'')?.[1]);
  if(title&&product&&title!==product)return null;
  const id=title||product,platform=id?.startsWith('CUSA')?'PS4':'PS5';
  if(id&&['PS4','PS5'].includes(game.platform?.toUpperCase())&&game.platform.toUpperCase()!==platform)return null;
  return id;
}
export function sonyRequest(library,profile){
  const titleIds=[...new Set(library.games.map(gameTitleId).filter(Boolean))].sort();
  if(!titleIds.length)throw Error('目前遊戲庫沒有可用的 CUSA／PPSA 遊戲 ID。請重新匯入官方遊戲庫 JSON。');
  if(titleIds.length>5000)throw Error('單次比對上限為 5,000 個遊戲 ID。');
  return {kind:'ps-game-base-sony-request',schemaVersion:1,expectedProfile:sonyProfile(profile),titleIds};
}
function trophy(raw){
  if(!raw||!/^NPWR\d{1,10}_\d{2}$/.test(raw.npCommunicationId||'')||!['trophy','trophy2'].includes(raw.npServiceName)||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>500||!Number.isSafeInteger(raw.earnedPlatinum)||!Number.isSafeInteger(raw.definedPlatinum)||raw.earnedPlatinum<0||raw.definedPlatinum<raw.earnedPlatinum||raw.platinum!==(raw.earnedPlatinum>0))throw Error('Sony 獎盃資料格式不正確。');
  return {npCommunicationId:raw.npCommunicationId,npServiceName:raw.npServiceName,name:raw.name,earnedPlatinum:raw.earnedPlatinum,definedPlatinum:raw.definedPlatinum,platinum:raw.platinum};
}
export function sonySnapshot(raw,expectedProfile){
  if(raw?.kind!=='ps-game-base-sony-platinums'||raw.schemaVersion!==1||typeof raw.complete!=='boolean'||!Array.isArray(raw.requestedTitleIds)||raw.requestedTitleIds.length>5000||raw.requestedTitleIds.some(id=>typeof id!=='string'||!idPattern.test(id))||new Set(raw.requestedTitleIds).size!==raw.requestedTitleIds.length||!Array.isArray(raw.games)||raw.games.length>10000||!Array.isArray(raw.mappings)||raw.mappings.length>5000||!Array.isArray(raw.failures)||raw.failures.length>6000)throw Error('不是支援的 Sony 白金比對 JSON。');
  const expected=sonyProfile(expectedProfile),profile={onlineId:null,verified:false};
  if(raw.profile?.verified===true){profile.onlineId=sonyProfile(raw.profile.onlineId);profile.verified=true;if(profile.onlineId.toLowerCase()!==expected.toLowerCase())throw Error(`這份資料屬於 ${profile.onlineId}，與指定的 ${expected} 不同；未套用標記。`);}
  const seen=new Set(),requested=new Set(raw.requestedTitleIds);
  const games=raw.games.map(item=>{
    const t=trophy(item),key=trophyKey(t);
    if(!t.platinum||seen.has(key)||!Array.isArray(item.platforms)||item.platforms.length>8||item.platforms.some(p=>typeof p!=='string'||!/^[A-Z0-9]{1,12}$/.test(p)))throw Error('Sony 白金清單含重複或無效資料。');
    seen.add(key);return {...t,platforms:[...new Set(item.platforms)]};
  });
  seen.clear();
  const mappings=raw.mappings.map(row=>{
    if(!row||!requested.has(row.titleId)||seen.has(row.titleId)||row.platform!==(row.titleId.startsWith('CUSA')?'PS4':'PS5')||!Array.isArray(row.trophies)||row.trophies.length>100)throw Error('Sony 遊戲 ID 對應格式不正確。');
    seen.add(row.titleId);const trophies=row.trophies.map(trophy),keys=trophies.map(trophyKey);
    if(new Set(keys).size!==keys.length)throw Error('同一遊戲 ID 含重複獎盃清單。');
    return {titleId:row.titleId,platform:row.platform,trophies};
  });
  const failures=raw.failures.map(item=>{if(!item||typeof item.stage!=='string'||item.stage.length>40||typeof item.error!=='string'||!/^[A-Z_]{1,60}$/.test(item.error))throw Error('查詢結果的錯誤紀錄格式不正確。');return {stage:item.stage,error:item.error,...(Number.isInteger(item.httpStatus)?{httpStatus:item.httpStatus}:{})};});
  return {kind:raw.kind,schemaVersion:1,complete:raw.complete,profile,requestedTitleIds:[...requested],games,mappings,failures};
}
export function planSonyPlatinums(library,personal,snapshot){
  const works=groupGames(library.games,library.missingIds),index=new Map(),automatic=[],already=[],review=[],unsupported=[];
  for(const work of works)for(const member of work.members){const id=gameTitleId(member);if(id){if(!index.has(id))index.set(id,new Map());index.get(id).set(work.key,work);}}
  const known=new Map(snapshot.games.map(t=>[trophyKey(t),t])),conflicts=new Set(),states=new Map(),handled=new Set(),pending=new Map();
  for(const t of snapshot.games)states.set(trophyKey(t),t.platinum);
  for(const row of snapshot.mappings)for(const t of row.trophies){const key=trophyKey(t);if(states.has(key)&&states.get(key)!==t.platinum)conflicts.add(key);states.set(key,t.platinum);}
  function suggestions(t){return works.filter(w=>w.platforms.some(p=>t.platforms.includes(p))&&titleMatch(w,t.name,workRecordFor(personal,w))).slice(0,8);}
  function addReview(t,reason,candidates=[]){const key=trophyKey(t);if(!pending.has(key))pending.set(key,{trophy:t,reason,candidates:candidates.length?candidates:suggestions(t)});}
  const autoByWork=new Map();
  for(const row of snapshot.mappings)for(const item of row.trophies){
    if(!item.platinum)continue;
    const key=trophyKey(item),t={...(known.get(key)||item),platforms:[row.platform]},candidates=[...(index.get(row.titleId)?.values()||[])];
    if(conflicts.has(key)){addReview(t,'同一獎盃清單的查詢狀態不一致，請確認。',candidates);continue;}
    if(item.npServiceName!==(row.platform==='PS5'?'trophy2':'trophy')){addReview(t,'遊戲平台與獎盃服務不一致。',candidates);continue;}
    if(candidates.length!==1){addReview(t,candidates.length?'同一遊戲 ID 對應多張作品卡。':'這個遊戲 ID 目前不在庫內，或來源 ID 有衝突。',candidates);continue;}
    const work=candidates[0];
    if(hasWorkConflicts(personal,work)){addReview(t,'作品原本的分類紀錄有差異，請手動確認。',[work]);continue;}
    handled.add(key);
    if(!autoByWork.has(work.key))autoByWork.set(work.key,{work,trophy:t,proofs:[]});
    autoByWork.get(work.key).proofs.push({source:'id',titleId:row.titleId,platform:row.platform,npCommunicationId:item.npCommunicationId});
  }
  // An exact title and one platform may fill a missing ID mapping. Never use
  // this fallback to bypass contradictory API evidence or ambiguous editions.
  const mappedIds=new Set(snapshot.mappings.filter(row=>row.trophies.length).map(row=>row.titleId));
  for(const t of snapshot.games){
    const key=trophyKey(t);
    if(handled.has(key))continue;
    if(!t.platforms.some(p=>['PS4','PS5'].includes(p))){unsupported.push(t);continue;}
    if(pending.has(key))continue;
    const candidates=suggestions(t);
    if(conflicts.has(key)){addReview(t,'同一獎盃清單的查詢狀態不一致，請確認。',candidates);continue;}
    if(t.platforms.length!==1||t.npServiceName!==(t.platforms[0]==='PS5'?'trophy2':'trophy')){addReview(t,'獎盃平台無法唯一確認，請手動配對。',candidates);continue;}
    if(candidates.length!==1){addReview(t,candidates.length?'同名、同平台有多張卡片，請確認版本。':'尚無遊戲 ID 對應，名稱也未完全相符；請手動配對。',candidates);continue;}
    const work=candidates[0],platform=t.platforms[0];
    const record=workRecordFor(personal,work),source=titleMatch(work,t.name,record);
    const sameTitle=snapshot.games.filter(other=>other.platforms.includes(platform)&&titleMatch(work,other.name,record));
    const ids=new Set(work.members.map(gameTitleId).filter(Boolean));
    const regions=new Set(work.members.map(g=>/^([A-Z]{2})\d/.exec(g.productId||'')?.[1]).filter(Boolean));
    if(sameTitle.length!==1||ids.size>1||regions.size>1){addReview(t,'同名、同平台有多份獎盃或區域版本，請手動確認。',candidates);continue;}
    if([...ids].some(id=>mappedIds.has(id))||autoByWork.has(work.key)){addReview(t,'庫內版本已有其他 ID 對應，請確認是否為相同獎盃版本。',candidates);continue;}
    if(hasWorkConflicts(personal,work)){addReview(t,'此平台原本的整理紀錄有差異，請手動確認。',candidates);continue;}
    handled.add(key);
    autoByWork.set(work.key,{work,trophy:t,proofs:[{source,platform,npCommunicationId:t.npCommunicationId}]});
  }
  for(const entry of autoByWork.values())(workRecordFor(personal,entry.work).status==='已白金'&&Object.hasOwn(personal.works,entry.work.key)?already:automatic).push(entry);
  review.push(...[...pending].filter(([key])=>!handled.has(key)).map(([,entry])=>entry));
  return {automatic,already,review,unsupported,noTitleId:library.games.filter(g=>!gameTitleId(g)).length,queried:snapshot.requestedTitleIds.length,mapped:snapshot.mappings.filter(row=>row.trophies.length).length};
}
