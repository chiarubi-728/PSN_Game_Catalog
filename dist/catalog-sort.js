import {dateValue} from './dates.js';
export const dateSorts={acquiredAt:'取得／領取時間',lastPlayedAt:'最後遊玩時間',lastTrophyAt:'最後獲得獎盃時間'};
export function compareCatalog(a,b,{field='name',direction=field==='name'?'asc':'desc'}={}){
  const byName=()=>a.name.localeCompare(b.name,'zh-Hant')||a.key.localeCompare(b.key);
  if(field==='name'||!Object.hasOwn(dateSorts,field))return byName()*(direction==='asc'?1:-1);
  const left=dateValue(a[field]),right=dateValue(b[field]);
  if(!left||!right)return left?-1:right?1:byName();
  return (Date.parse(left)-Date.parse(right))*(direction==='asc'?1:-1)||byName();
}
