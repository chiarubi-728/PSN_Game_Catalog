import {dateValue,extremeDate} from './dates.js';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw Error(message);};
export function historyProfile(value){
  if(typeof value!=='string')fail('請填入 PSN 帳號。');
  let name=value.trim();
  if(name.startsWith('https://')){const url=new URL(name);if(url.origin!=='https://psnprofiles.com'||!/^\/[\w-]+\/?$/.test(url.pathname))fail('請填入 PSNProfiles 個人頁或 PSN 帳號。');name=url.pathname.split('/')[1];}
  if(!/^[A-Za-z0-9_-]{1,32}$/.test(name))fail('PSN 帳號格式不正確。');
  return name;
}
function image(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}}
function count(value){if(value===null||value===undefined)return null;if(!Number.isSafeInteger(value)||value<0||value>100000)fail('獎盃數量格式不正確。');return value;}
function normalizeGame(raw,provider,profile){
  if(!object(raw)||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>500||!Array.isArray(raw.platforms)||!raw.platforms.length||raw.platforms.length>8||typeof raw.platinum!=='boolean')fail('遊玩紀錄格式不正確。');
  const platforms=[...new Set(raw.platforms.map(p=>p==='PSVITATV'?'PSVITA':p==='PSPC'?'PC':p))].sort();
  if(platforms.some(p=>!['PS3','PS4','PS5','PSVITA','PC'].includes(p)))fail('遊玩紀錄的平台格式不正確。');
  let id,url;
  if(provider==='sony'){
    if(!['trophy','trophy2'].includes(raw.npServiceName)||!/^NPWR\d{1,10}_\d{2}$/.test(raw.npCommunicationId||''))fail('Sony 獎盃 ID 格式不正確。');
    id=raw.npServiceName+':'+raw.npCommunicationId;
  }else{
    if(!/^\d{1,10}$/.test(raw.psnprofilesId||''))fail('PSNProfiles 遊戲 ID 格式不正確。');
    id=raw.psnprofilesId;
    const parsed=new URL(raw.url);
    if(parsed.origin!=='https://psnprofiles.com'||!new RegExp('^/trophies/'+id+'-[^/]+/'+profile+'/?$','i').test(parsed.pathname)||parsed.search||parsed.hash||parsed.username||parsed.password)fail('PSNProfiles 遊戲來源不正確。');
    url=parsed.href;
  }
  const progress=raw.progress??null;
  if(progress!==null&&(!Number.isFinite(progress)||progress<0||progress>100))fail('獎盃進度格式不正確。');
  const earnedTotal=count(raw.earnedTotal),definedTotal=count(raw.definedTotal);
  if(earnedTotal!==null&&definedTotal!==null&&earnedTotal>definedTotal)fail('獎盃數量超過總數。');
  if(raw.region!==undefined&&(typeof raw.region!=='string'||!/^[A-Z]{2,5}$/.test(raw.region)))fail('遊戲區域格式不正確。');
  return {id,name:raw.name.trim(),platforms,platinum:raw.platinum,progress,earnedTotal,definedTotal,
    ...(dateValue(raw.lastTrophyAt)?{lastTrophyAt:dateValue(raw.lastTrophyAt)}:{}),
    ...(url?{url,psnprofilesId:id}:{npServiceName:raw.npServiceName,npCommunicationId:raw.npCommunicationId}),
    ...(image(raw.imageUrl)?{imageUrl:image(raw.imageUrl)}:{}),...(raw.region?{region:raw.region}:{})};
}
export function historySnapshot(input,expectedProfile){
  let provider,profile,games,coverage='all',complete,updatedAt,mappings=[];
  if(input?.kind==='ps-game-base-played'&&input.schemaVersion===1){
    ({provider,profile,games,coverage,complete,updatedAt,mappings=[]}=input);
  }else if(['ps-game-base-psnprofiles-history','ps-game-base-platinums'].includes(input?.kind)&&input.schemaVersion===1){
    provider='psnprofiles';profile=input.profile;games=input.games;complete=input.complete;updatedAt=input.exportedAt;
    coverage=input.kind==='ps-game-base-platinums'?'platinum':'all';
    if(coverage==='platinum'&&Array.isArray(games))games=games.map(g=>({...g,platinum:true}));
  }else if(['ps-game-base-sony-platinums','ps-game-base-sony-history'].includes(input?.kind)&&input.schemaVersion===1){
    provider='sony';profile=input.profile?.verified?input.profile.onlineId:expectedProfile;complete=input.complete;updatedAt=input.generatedAt;
    coverage=input.kind==='ps-game-base-sony-platinums'?'platinum':'all';
    if(!Array.isArray(input.games)||!Array.isArray(input.mappings))fail('Sony 獎盃資料格式不正確。');
    const byId=new Map(input.games.map(g=>[g.npServiceName+':'+g.npCommunicationId,g]));
    mappings=input.mappings.map(row=>{
      if(!object(row)||!/^(CUSA|PPSA)\d{5}_\d{2}$/.test(row.titleId||'')||!Array.isArray(row.trophies))fail('Sony 遊戲 ID 對應格式不正確。');
      const platform=row.titleId.startsWith('CUSA')?'PS4':'PS5';
      if(row.platform!==platform)fail('Sony 遊戲 ID 與平台不一致。');
      for(const t of row.trophies){
        const id=t.npServiceName+':'+t.npCommunicationId,previous=byId.get(id);
        if(previous&&previous.platinum!==t.platinum)fail('同一獎盃清單的白金狀態不一致，請重新同步。');
        if(!previous)byId.set(id,{...t,platforms:[platform]});
      }
      return {titleId:row.titleId,platform,trophyIds:row.trophies.map(t=>t.npServiceName+':'+t.npCommunicationId)};
    });
    games=[...byId.values()];
  }else fail('不是支援的完整遊玩紀錄 JSON。');
  if(!['sony','psnprofiles'].includes(provider)||!['all','platinum'].includes(coverage)||typeof complete!=='boolean'||!Array.isArray(games)||games.length>10000||!Array.isArray(mappings)||mappings.length>5000)fail('遊玩紀錄資料格式不正確。');
  profile=historyProfile(profile);
  if(expectedProfile&&profile.toLowerCase()!==historyProfile(expectedProfile).toLowerCase())fail('這份遊玩紀錄的帳號與指定帳號不同。');
  const seen=new Set(),normalized=games.map(raw=>{const game=normalizeGame(raw,provider,profile);if(seen.has(game.id))fail('遊玩紀錄有重複 ID。');seen.add(game.id);return game;});
  const normalizedMappings=mappings.map(row=>{
    if(!object(row)||!/^(CUSA|PPSA)\d{5}_\d{2}$/.test(row.titleId||'')||row.platform!==(row.titleId.startsWith('CUSA')?'PS4':'PS5')||!Array.isArray(row.trophyIds)||row.trophyIds.length>100||row.trophyIds.some(id=>typeof id!=='string'||!/^trophy2?:NPWR\d{1,10}_\d{2}$/.test(id)||!seen.has(id)))fail('遊玩紀錄的 ID 對應不正確。');
    return {titleId:row.titleId,platform:row.platform,trophyIds:[...new Set(row.trophyIds)]};
  });
  return {kind:'ps-game-base-played',schemaVersion:1,provider,profile,coverage,complete,updatedAt:typeof updatedAt==='string'&&Number.isFinite(Date.parse(updatedAt))?new Date(updatedAt).toISOString():new Date().toISOString(),games:normalized,mappings:normalizedMappings};
}
export function emptyHistory(){return {schemaVersion:1,profile:null,sources:{}};}
export function trophyStatistics(history){
  // Source IDs count trophy lists once, independently of ownership cards or
  // personal labels. Prefer the complete public profile as the total's basis.
  const sources=history?.sources||{},source=[sources.psnprofiles,sources.sony].find(item=>item?.coverage==='all'&&item.complete)||sources.psnprofiles||sources.sony;
  const games=[...new Map((source?.games||[]).map(game=>[game.id,game])).values()];
  const platinum=games.filter(game=>game.platinum).length;
  return {provider:source?.provider||null,coverage:source?.coverage||null,played:games.length,platinum,unfinished:games.length-platinum};
}
export function readHistory(input){
  if(input===undefined)return emptyHistory();
  if(!object(input)||input.schemaVersion!==1||!object(input.sources))fail('遊玩紀錄儲存格式不正確。');
  let result=emptyHistory();
  for(const provider of ['sony','psnprofiles'])if(input.sources[provider]){
    const snapshot=historySnapshot(input.sources[provider],result.profile||undefined);
    if(snapshot.provider!==provider)fail('遊玩紀錄來源不一致。');
    result={schemaVersion:1,profile:snapshot.profile,sources:{...result.sources,[provider]:snapshot}};
  }
  return result;
}
export function mergeHistory(previous,snapshot){
  const history=readHistory(previous),incoming=historySnapshot(snapshot,history.profile||undefined),old=history.sources[incoming.provider];
  const byId=new Map((old?.games||[]).map(game=>[game.id,game]));
  for(const game of incoming.games){const before=byId.get(game.id);byId.set(game.id,{...before,...game,progress:game.progress??before?.progress??null,earnedTotal:game.earnedTotal??before?.earnedTotal??null,definedTotal:game.definedTotal??before?.definedTotal??null,...(game.lastTrophyAt||before?.lastTrophyAt?{lastTrophyAt:extremeDate([game.lastTrophyAt,before?.lastTrophyAt])}:{})});}
  const mappings=new Map((old?.mappings||[]).map(row=>[row.titleId,row]));
  for(const row of incoming.mappings)mappings.set(row.titleId,row);
  const latestIds=new Set(incoming.games.map(game=>game.id));
  const ordered=incoming.coverage==='all'&&incoming.complete?[...incoming.games.map(game=>byId.get(game.id)),...[...byId.values()].filter(game=>!latestIds.has(game.id))]:[...byId.values()];
  const next={...incoming,coverage:old?.coverage==='all'?'all':incoming.coverage,games:ordered,mappings:[...mappings.values()]};
  return {schemaVersion:1,profile:incoming.profile,sources:{...history.sources,[incoming.provider]:next}};
}
