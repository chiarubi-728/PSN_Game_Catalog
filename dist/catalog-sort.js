import {dateValue} from './dates.js';
export const dateSorts={acquiredAt:'取得／領取時間',lastTrophyAt:'最後獲得獎盃時間'};
export function compareCatalog(a,b,{field='name',direction=field==='name'?'asc':'desc',useAcquisitionOrder=false}={}){
  const byName=()=>a.name.localeCompare(b.name,'zh-Hant')||a.key.localeCompare(b.key);
  if(field==='name'||!Object.hasOwn(dateSorts,field))return byName()*(direction==='asc'?1:-1);
  if(field==='acquiredAt'&&useAcquisitionOrder){
    const left=Number.isSafeInteger(a.acquisitionRank)&&a.acquisitionRank>=0,right=Number.isSafeInteger(b.acquisitionRank)&&b.acquisitionRank>=0;
    if(!left||!right)return left?-1:right?1:byName();
    return (a.acquisitionRank-b.acquisitionRank)*(direction==='desc'?1:-1)||byName();
  }
  const left=dateValue(a[field]),right=dateValue(b[field]);
  if(!left||!right)return left?-1:right?1:byName();
  return (Date.parse(left)-Date.parse(right))*(direction==='asc'?1:-1)||byName();
}

export function catalogSortPlan(cards,field){
  return {useAcquisitionOrder:field==='acquiredAt'&&cards.some(card=>Number.isSafeInteger(card.acquisitionRank)&&card.acquisitionRank>=0&&!dateValue(card.acquiredAt))};
}
export function catalogSortSummary(cards,field,sync={}){
  if(!Object.hasOwn(dateSorts,field))return '';
  const count=cards.filter(card=>dateValue(card[field])).length,orderCount=cards.filter(card=>Number.isSafeInteger(card.acquisitionRank)&&card.acquisitionRank>=0).length;
  if(catalogSortPlan(cards,field).useAcquisitionOrder)return '取得／領取時間：'+orderCount+' 款依 Sony 取得順序排列（同卡採最早一筆授權）；'+count+' / '+cards.length+' 款有確切日期。沒有順序資料的排在最後，不推算日期。';
  let text=dateSorts[field]+'：'+count+' / '+cards.length+' 款有日期，沒有日期的排在最後。';
  if(!count){
    const error=field==='acquiredAt'?sync.acquiredError:null;
    if(error==='NO_TOKEN')text+='Sony 網頁登入未提供日期 API 所需權杖。請更新至 v0.3.6 後重新同步，將使用 Sony 回傳的取得先後順序。';
    else if(/^HTTP_\d{3}$/.test(error||''))text+='日期來源回報 '+error.replace('_',' ')+'；遊戲庫仍已保存。';
    else if(error)text+='日期來源暫無法讀取（'+error+'）；遊戲庫仍已保存。';
    else text+='可更新整合腳本後重新同步；來源未提供的日期會留空。';
  }
  return text;
}
