// Localized titles are explicit equivalences, never machine translations or
// fuzzy matches. Keep edition subtitles intact. Add only verified game names.
export const verifiedTitleGroups = [{
  names:['It Takes Two','雙人成行'],
  sources:[
    'https://store.playstation.com/en-tw/product/UP0006-PPSA02342_00-ITTAKESTWORETAIL/',
    'https://store.playstation.com/zh-hant-tw/product/UP0006-PPSA02342_00-ITTAKESTWORETAIL',
  ],
}];
// The Sony library's numeric spelling and the trophy title's Roman spelling
// refer to the 2023 game on PS4/PS5. Keep this scoped: the PS3 MW3 is distinct.
// These aliases establish matching only; they do not strip edition subtitles.
export const verifiedPlatformTitleGroups=[{
  platforms:['PS4','PS5'],
  names:[
    'Call of Duty: Modern Warfare III',
    'Call of Duty Modern Warfare III',
    'Call of Duty: Modern Warfare 3',
    'Call of Duty Modern Warfare 3',
  ],
  sources:[
    'https://www.playstation.com/en-us/games/call-of-duty-modern-warfare-iii/',
    'https://store.playstation.com/en-us/concept/10011645',
  ],
}];
// Display aliases may cross platforms without joining their source records.
export const verifiedDisplayTitleGroups=[...verifiedTitleGroups,{
  names:['Destiny 2','天命2'],
  sources:['https://www.playstation.com/zh-hant-tw/games/destiny-2/'],
},{
  names:['Battlefield 1','戰地風雲 1'],
  sources:['https://www.ea.com/zh-hant/games/battlefield/battlefield-1/buy/addon/battlefield-1-they-shall-not-pass'],
},{
  names:['Battlefield 4','戰地風雲 4'],
  sources:['https://www.playstation.com/zh-hant-tw/games/battlefield-4/'],
},{
  names:['Battlefield V','Battlefield 5','戰地風雲 5'],
  sources:['https://www.playstation.com/zh-hant-tw/games/battlefield-v/'],
},{
  names:['Battlefield 2042','戰地風雲 2042'],
  sources:['https://www.playstation.com/zh-hant-tw/games/battlefield-2042/'],
},{
  names:['Battlefield 6','戰地風雲 6'],
  sources:['https://www.playstation.com/zh-hant-tw/games/battlefield-6/'],
},{
  names:['Battlefield REDSEC','戰地風雲 禁區衝突'],
  sources:['https://www.playstation.com/zh-hant-tw/games/battlefield-redsec/'],
}];
// Exact current product identity takes precedence over a stale library label.
export const verifiedProductTitleGroups=[{
  productId:'UP0006-PPSA34132_00-BATTLEFIELDMULTI',
  names:['Battlefield REDSEC','戰地風雲 禁區衝突'],
  sources:[
    'https://store.playstation.com/en-us/product/UP0006-PPSA34132_00-BATTLEFIELDMULTI',
    'https://store.playstation.com/zh-hant-tw/product/UP0006-PPSA34132_00-BATTLEFIELDMULTI',
  ],
},{
  productId:'HP9000-CUSA10218_00-HRZCE00000000000',
  names:[
    'Horizon Zero Dawn: Complete Edition',
    'Horizon Zero Dawn: Complete Edition PlayStationHits',
  ],
  sources:[
    'https://store.playstation.com/en-tw/product/HP9000-CUSA10218_00-HRZCE00000000000',
    'https://store.playstation.com/zh-hant-tw/product/HP9000-CUSA10218_00-HRZCE00000000000',
  ],
}];
// Franchise labels expand search terms only, never game identity or ownership.
export const verifiedSearchSeries=[{
  names:['Battlefield','戰地風雲'],
  sources:['https://www.playstation.com/zh-hant-tw/games/battlefield-v/'],
}];
export function titleKey(name) {
  return name.replace(/[™®]/g,'').normalize('NFKC').replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
}
const groups=[...verifiedTitleGroups,...verifiedPlatformTitleGroups].map(group=>({...group,keys:new Set(group.names.map(titleKey))}));
export function hasRememberedTitle(record,name){
  const key=titleKey(name);
  return !!key&&(record.titleAliases||[]).some(alias=>titleKey(alias)===key);
}
export function titleMatch(work,name,record){
  const key=titleKey(name);if(!key)return null;
  const names=work.members.map(g=>titleKey(g.name));
  if(names.includes(key))return 'name-platform';
  if(hasRememberedTitle(record,name))return 'remembered-title';
  if(groups.some(group=>(!group.platforms||work.platforms?.length&&work.platforms.every(platform=>group.platforms.includes(platform)))&&group.keys.has(key)&&names.some(other=>group.keys.has(other))))return 'localized-title';
  return null;
}
export function rememberTitle(record,name){
  if(name===undefined)return record;
  if(typeof name!=='string'||!titleKey(name)||name.length>500)throw Error('白金配對名稱格式不正確。');
  if(hasRememberedTitle(record,name))return record;
  const aliases=record.titleAliases||[];
  if(aliases.length>=50)throw Error('此平台最多保存 50 個白金配對名稱，請先在遊戲編輯視窗整理。');
  return {...record,titleAliases:[...aliases,name.trim()]};
}
