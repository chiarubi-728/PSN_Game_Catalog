// Localized titles are explicit equivalences, never machine translations or
// fuzzy matches. Keep edition subtitles intact. Add only verified game names.
export const verifiedTitleGroups = [{
  names:['It Takes Two','雙人成行'],
  sources:[
    'https://store.playstation.com/en-tw/product/UP0006-PPSA02342_00-ITTAKESTWORETAIL/',
    'https://store.playstation.com/zh-hant-tw/product/UP0006-PPSA02342_00-ITTAKESTWORETAIL',
  ],
}];
export function titleKey(name) {
  return name.replace(/[™®]/g,'').normalize('NFKC').replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
}
const groups=verifiedTitleGroups.map(group=>new Set(group.names.map(titleKey)));
export function hasRememberedTitle(record,name){
  const key=titleKey(name);
  return !!key&&(record.titleAliases||[]).some(alias=>titleKey(alias)===key);
}
export function titleMatch(work,name,record){
  const key=titleKey(name);if(!key)return null;
  const names=work.members.map(g=>titleKey(g.name));
  if(names.includes(key))return 'name-platform';
  if(hasRememberedTitle(record,name))return 'remembered-title';
  if(groups.some(group=>group.has(key)&&names.some(other=>group.has(other))))return 'localized-title';
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
