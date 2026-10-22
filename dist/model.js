import {readHistory,historySnapshot,mergeHistory,emptyHistory,historyProfile} from './history.js';
import {readStoreNames} from './store-names.js';
import {dateValue,readPlayActivity,extremeDate} from './dates.js';
import {readHistoryLinks} from './history-links.js';
export const statuses = ['未開始', '想玩', '遊玩中', '已破關', '已白金', '暫停', '不再遊玩'];
// Keep existing stored codes; only these three are offered for new choices.
export const classificationOptions = [
  {value:'已白金',label:'白金',icon:'trophy',tone:'platinum'},
  {value:'不再遊玩',label:'忽略',icon:'circle-x',tone:'ignored'},
  {value:'想玩',label:'追蹤',icon:'bookmark',tone:'tracked'},
];
export const classificationFor = value => classificationOptions.find(option => option.value === value);
// A personal platinum can coexist with a later tracked/ignored marker.
export const personalPlatinum = record => record.manualPlatinum ?? (record.status==='已白金');
export function matchesClassification(value, {view='all',filter='',customCategory=false} = {}) {
  if (filter === 'unclassified') { if (classificationFor(value)) return false; }
  else if (filter === 'exclude-ignored') { if (value === '不再遊玩') return false; }
  else if (filter && value !== filter) return false;
  if (!customCategory) {
    const expected = {platinum:'已白金',ignored:'不再遊玩',tracked:'想玩'}[view];
    if (expected && value !== expected) return false;
  }
  return true;
}
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw new Error(message); };
export function library(input) {
  if (!object(input) || input.schemaVersion !== 1 || !Array.isArray(input.games) || typeof input.complete !== 'boolean') fail('不是支援的遊戲庫 JSON（schemaVersion: 1）。');
  const ids = new Set();
  const games = input.games.map(g => {
    if (!object(g) || typeof g.entitlementId !== 'string' || !g.entitlementId.trim() || typeof g.name !== 'string' || !g.name.trim()) fail('遊戲缺少名稱或 entitlementId。');
    if (ids.has(g.entitlementId)) fail('遊戲庫含重複的 entitlementId。');
    ids.add(g.entitlementId);
    const out = {};
    for (const k of ['name','entitlementId','platform','membership','productId','titleId','conceptId']) if (typeof g[k] === 'string') out[k] = g[k];
    for (const k of ['isActive','isDownloadable','isPreOrder']) if (typeof g[k] === 'boolean') out[k] = g[k];
    for(const k of ['acquiredAt','lastPlayedAt']){const date=dateValue(g[k]);if(date)out[k]=date;}
    if (typeof g.imageUrl === 'string') { try { const u = new URL(g.imageUrl); if (u.protocol === 'https:') out.imageUrl = u.href; } catch {} }
    return out;
  });
  let account;
  if(input.account!==undefined){
    if(!object(input.account)||input.account.method!=='user'||typeof input.account.confirmedAt!=='string'||!Number.isFinite(Date.parse(input.account.confirmedAt)))fail('數位遊戲庫的帳號確認資訊不正確。');
    account={profile:historyProfile(input.account.profile),method:'user',confirmedAt:new Date(input.account.confirmedAt).toISOString()};
  }
  const dateSync={};
  for(const key of ['acquired','played'])if(['complete','partial','unavailable'].includes(input.dateSync?.[key]))dateSync[key]=input.dateSync[key];
  for(const key of ['acquiredError','playedError','webPlayedError'])if(/^(?:HTTP_\d{3}|NETWORK|TIMEOUT|FORMAT_CHANGED|PARTIAL|STOPPED|NO_TOKEN|UNAVAILABLE|GRAPHQL_ERROR|NO_DATA)$/.test(input.dateSync?.[key]||''))dateSync[key]=input.dateSync[key];
  const acquisitionOrder=Array.isArray(input.acquisitionOrder)&&input.complete&&input.acquisitionOrder.length<=10000&&new Set(input.acquisitionOrder).size===input.acquisitionOrder.length&&input.acquisitionOrder.every(id=>typeof id==='string'&&ids.has(id))?[...input.acquisitionOrder]:null;
  return {schemaVersion:1, scope:'active-ps4-ps5-digital-entitlements', ...(acquisitionOrder?{acquisitionOrder}:{}),complete:input.complete, syncedAt:typeof input.syncedAt === 'string' ? input.syncedAt : null, games,...(account?{account}:{}),...(input.playActivity!==undefined?{playActivity:readPlayActivity(input.playActivity)}:{}),...(Object.keys(dateSync).length?{dateSync}:{})};
}
export function assertCatalogAccount(data,expectedProfile){
  const profiles=[data.library?.account?.profile,data.history?.profile,expectedProfile].filter(Boolean).map(historyProfile);
  if(new Set(profiles.map(value=>value.toLowerCase())).size>1)fail('數位遊戲庫與遊玩紀錄的 PSN 帳號不同，已停止合併。請先匯出備份，使用對應帳號的遊戲庫。');
  return data;
}
export function emptyPersonal() { return {schemaVersion:1, kind:'ps-game-base-personal', categories:[], records:{}, works:{}}; }
function strings(v) { if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x.trim() || x.length > 100)) fail('分類或標籤格式不正確（每項 1–100 字）。'); return [...new Set(v)]; }
export function personal(input) {
  if (!object(input) || input.schemaVersion !== 1 || input.kind !== 'ps-game-base-personal' || !object(input.records)) fail('不是支援的個人分類 JSON。');
  if (input.works !== undefined && !object(input.works)) fail('作品整理格式不正確。');
  const categories = strings(input.categories);
  function readRecords(source) {
  const records = Object.create(null);
  for (const [id,r] of Object.entries(source)) {
    if (!id.trim() || !object(r) || !statuses.includes(r.status) || typeof r.favorite !== 'boolean' || !Number.isInteger(r.rating) || r.rating < 0 || r.rating > 5 || typeof r.note !== 'string' || r.note.length > 10000 || r.platinumReview!==undefined&&typeof r.platinumReview!=='boolean' || r.platinumReview===true&&r.status==='已白金') fail('個人分類紀錄格式不正確。');
    const cats = strings(r.categories), tags = strings(r.tags);
    const aliases=r.titleAliases;
    if(aliases!==undefined&&(!Array.isArray(aliases)||aliases.length>50||aliases.some(name=>typeof name!=='string'||!name.trim()||name.length>500)))fail('白金配對名稱格式不正確（最多 50 個，每個 1–500 字）。');
    if (cats.some(c => !categories.includes(c))) fail('紀錄引用了不存在的分類。');
    if(r.linkedKeys!==undefined&&(!Array.isArray(r.linkedKeys)||r.linkedKeys.length>1000||r.linkedKeys.some(key=>typeof key!=='string'||key.length>2000||!key.startsWith('platform:')&&!key.startsWith('played:'))))fail('個人整理的來源識別資訊不正確。');
    if(r.statusUpdatedAt!==undefined&&(typeof r.statusUpdatedAt!=='string'||!Number.isFinite(Date.parse(r.statusUpdatedAt))))fail('個人標記的修改時間不正確。');
    if(r.manualPlatinum!==undefined&&typeof r.manualPlatinum!=='boolean')fail('個人白金標記格式不正確。');
    records[id] = {status:r.status, favorite:r.favorite, rating:r.rating, note:r.note, categories:cats, tags, updatedAt:typeof r.updatedAt === 'string' ? r.updatedAt : '',...(r.platinumReview===true?{platinumReview:true}:{}),...(r.manualPlatinum!==undefined?{manualPlatinum:r.manualPlatinum}:{}),...(aliases?.length?{titleAliases:[...new Set(aliases.map(name=>name.trim()))]}:{}),...(r.linkedKeys?.length?{linkedKeys:[...new Set(r.linkedKeys)]}:{}),...(r.statusUpdatedAt?{statusUpdatedAt:r.statusUpdatedAt}:{})};
  }
  return records;
  }
  const historyLinks=readHistoryLinks(input.historyLinks);
  return {schemaVersion:1,kind:'ps-game-base-personal',categories,records:readRecords(input.records),works:readRecords(input.works || {}),...(historyLinks.length?{historyLinks}:{})};
}
export function blankRecord() { return {status:statuses[0],favorite:false,rating:0,note:'',categories:[],tags:[],updatedAt:''}; }
export function recordFor(data,id) { return Object.hasOwn(data.records,id) ? data.records[id] : blankRecord(); }
// Display grouping never deletes or rewrites the source entitlements.
export function groupGames(games, missingIds = []) {
  const grouped = new Map(), missing = new Set(missingIds);
  for (const game of games) {
    const concept = typeof game.conceptId === 'string' ? game.conceptId.trim() : '';
    const product = typeof game.productId === 'string' ? game.productId.trim() : '';
    const key = concept ? 'concept:' + concept : product ? 'product:' + product : 'entitlement:' + game.entitlementId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(game);
  }
  return [...grouped].map(([key, members]) => {
    members.sort((a,b) => Number(missing.has(a.entitlementId))-Number(missing.has(b.entitlementId)) || Number(b.platform?.toUpperCase()==='PS5')-Number(a.platform?.toUpperCase()==='PS5') || a.entitlementId.localeCompare(b.entitlementId));
    const platforms = [...new Set(members.map(g => g.platform?.toUpperCase()).filter(Boolean))].sort();
    return {...members[0], imageUrl:members.find(g => g.imageUrl)?.imageUrl, key, members, platforms, missingCount:members.filter(g => missing.has(g.entitlementId)).length};
  });
}
// Platform cards retain the existing concept/product grouping within each
// platform. Entitlements and old shared work records remain untouched.
export function platformWorkKey(baseKey, platform) {
  return 'platform:' + encodeURIComponent(platform || 'UNKNOWN') + ':' + baseKey;
}
export function platformGames(games, missingIds = []) {
  const missing = new Set(missingIds);
  return groupGames(games, missingIds).flatMap(base => {
    const groups = new Map();
    for (const game of base.members) {
      const platform = game.platform?.trim().toUpperCase() || '';
      if (!groups.has(platform)) groups.set(platform, []);
      groups.get(platform).push(game);
    }
    return [...groups].map(([platform, members]) => ({
      ...members[0], imageUrl:members.find(g=>g.imageUrl)?.imageUrl,
      key:platformWorkKey(base.key, platform), baseKey:base.key,
      platformSplit:true, baseMembers:base.members, members,
      platforms:platform ? [platform] : [],
      missingCount:members.filter(g=>missing.has(g.entitlementId)).length,
    }));
  });
}
function platformLegacyRecords(data, work) {
  const saved = [];
  const own = key => data.works && Object.hasOwn(data.works,key);
  // Follow platform-specific edits through product -> concept metadata changes.
  for (const g of work.members) {
    const product = typeof g.productId === 'string' ? g.productId.trim() : '';
    for (const base of ['entitlement:'+g.entitlementId,...(product?['product:'+product]:[])]) {
      const key = platformWorkKey(base,g.platform?.trim().toUpperCase());
      if (key !== work.key && own(key)) saved.push({id:key,record:data.works[key]});
    }
  }
  if (saved.length) return saved;
  if (own(work.baseKey)) return [{id:work.baseKey,record:data.works[work.baseKey]}];
  return legacyWorkRecords(data,work);
}
function ambiguousPlatinum(work, source) {
  if (source.record.status !== '已白金' || source.id.startsWith('platform:')) return false;
  let members;
  if (source.id === work.baseKey) members = work.baseMembers;
  else if (source.id.startsWith('product:')) members = work.baseMembers.filter(g=>'product:'+(g.productId?.trim() || '')===source.id);
  else return false; // A legacy entitlement record identifies one version.
  return new Set(members.map(g=>g.platform?.trim().toUpperCase() || '')).size > 1;
}
export function needsPlatformPlatinumReview(data, work) {
  if (!work.platformSplit) return false;
  if(data.works&&Object.hasOwn(data.works,work.key))return data.works[work.key].platinumReview===true;
  const saved = platformLegacyRecords(data,work);
  saved.sort((a,b)=>b.record.updatedAt.localeCompare(a.record.updatedAt)||a.id.localeCompare(b.id));
  return !!saved.length && (saved[0].record.platinumReview===true||ambiguousPlatinum(work,saved[0]));
}
export function workRecordFor(data, work) {
  if (data.works && Object.hasOwn(data.works, work.key)) return data.works[work.key];
  // Existing entitlement notes stay intact. Use the most recently saved record
  // until the user makes a shared edit; ties are resolved by stable record key.
  const saved = work.platformSplit ? platformLegacyRecords(data,work) : legacyWorkRecords(data,work);
  saved.sort((a,b) => b.record.updatedAt.localeCompare(a.record.updatedAt) || a.id.localeCompare(b.id));
  if (work.platformSplit && saved.length && (saved[0].record.platinumReview===true||ambiguousPlatinum(work,saved[0]))) return {...saved[0].record,status:'未開始',platinumReview:true};
  return saved.length ? saved[0].record : blankRecord();
}
function legacyWorkRecords(data,work) {
  return work.members.flatMap(g => {
    const product = typeof g.productId === 'string' ? g.productId.trim() : '';
    const keys = ['entitlement:' + g.entitlementId, ...(product ? ['product:' + product] : [])]
      .filter(key => key !== work.key && data.works && Object.hasOwn(data.works,key));
    if (keys.length) return keys.map(key => ({id:key,record:data.works[key]}));
    return Object.hasOwn(data.records,g.entitlementId) ? [{id:g.entitlementId,record:data.records[g.entitlementId]}] : [];
  });
}
export function hasWorkConflicts(data, work) {
  if (data.works && Object.hasOwn(data.works,work.key)) return false;
  const values = (work.platformSplit ? platformLegacyRecords(data,work) : legacyWorkRecords(data,work)).map(({record:r}) => {
    return JSON.stringify([r.status,r.note,[...r.categories].sort(),[...r.tags].sort(),[...(r.titleAliases||[])].sort()]);
  });
  return new Set(values).size > 1;
}
export function matchesWorkFilters(work, {platform='', membership='', missingOnly=false} = {}, missingIds = []) {
  const missing = new Set(missingIds);
  return work.members.some(g => (!platform || g.platform?.toUpperCase() === platform) && (!membership || (membership === 'UNKNOWN' ? !['NONE','PS_PLUS'].includes(g.membership) : g.membership === membership)) && (!missingOnly || missing.has(g.entitlementId)));
}
export function mergeLibrary(previous, incoming) {
  const next = library(incoming), old = previous?.games || [];
  const byId = new Map(old.map(g => [g.entitlementId,g]));
  const added = next.games.filter(g => !byId.has(g.entitlementId)).length;
  const current = new Set(next.games.map(g => g.entitlementId));
  const missingIds = next.complete ? old.filter(g => !current.has(g.entitlementId)).map(g => g.entitlementId) : (previous?.missingIds || []).filter(id => !current.has(id));
  for (const g of next.games){const before=byId.get(g.entitlementId);byId.set(g.entitlementId,{...g,...(g.acquiredAt||before?.acquiredAt?{acquiredAt:g.acquiredAt||before.acquiredAt}:{}),...(g.lastPlayedAt||before?.lastPlayedAt?{lastPlayedAt:extremeDate([g.lastPlayedAt,before?.lastPlayedAt])}:{})});}
  if(previous?.account&&next.account&&previous.account.profile.toLowerCase()!==next.account.profile.toLowerCase())fail('兩份數位遊戲庫屬於不同 PSN 帳號，已停止合併。');
  return {...next, games:[...byId.values()], missingIds, added,...(next.account||previous?.account?{account:next.account||previous.account}:{}),...(next.playActivity||previous?.playActivity?{playActivity:readPlayActivity([...(previous?.playActivity||[]),...(next.playActivity||[])])}:{})};
}
export function parseImport(input) {
  if(input?.kind==='ps-game-base-store-names')return {storeNames:readStoreNames(input)};
  if(input?.kind==='ps-game-base-history')return {history:readHistory(input)};
  if(['ps-game-base-psnprofiles-history','ps-game-base-platinums','ps-game-base-played','ps-game-base-sony-platinums','ps-game-base-sony-history'].includes(input?.kind)){
    if(input.kind.startsWith('ps-game-base-sony-')&&input.profile?.verified!==true)throw Error('請從同步遊玩紀錄視窗匯入這份 Sony 資料，先確認帳號。');
    return {history:mergeHistory(emptyHistory(),historySnapshot(input))};
  }
  if (input?.kind === 'ps-game-base-backup' && input.schemaVersion === 1) return assertCatalogAccount({library:library(input.library),personal:personal(input.personal),history:readHistory(input.history),storeNames:readStoreNames(input.storeNames), missingIds:Array.isArray(input.missingIds) ? input.missingIds.filter(x => typeof x === 'string') : []});
  if (input?.kind === 'ps-game-base-personal') return {personal:personal(input)};
  return {library:library(input)};
}
