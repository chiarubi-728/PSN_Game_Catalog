// Unknown/invalid dates remain unknown; never substitute a sync or import date.
export function dateValue(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))return null;
  const [year,month,day]=value.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,day));
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return null;
  const stamp=Date.parse(value);
  if(!Number.isFinite(stamp)||year<1990||stamp>Date.now()+86400000)return null;
  return value.length===10?value:new Date(stamp).toISOString();
}
export function extremeDate(values,newest=true){
  const dates=values.map(dateValue).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b));
  return dates.length?dates[newest?dates.length-1:0]:null;
}
export function readPlayActivity(value){
  if(!Array.isArray(value)||value.length>20000)return [];
  const records=new Map();
  for(const raw of value){
    const lastPlayedAt=dateValue(raw?.lastPlayedAt),titleId=raw?.titleId;
    if(!lastPlayedAt||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>500||!/^(CUSA|PPSA)\d{5}_\d{2}$/.test(titleId||'')||raw.platform!==(titleId.startsWith('CUSA')?'PS4':'PS5'))continue;
    if(!records.has(titleId)&&records.size>=10000)continue;
    const before=records.get(titleId);
    records.set(titleId,{titleId,platform:raw.platform,name:raw.name.trim(),lastPlayedAt:extremeDate([before?.lastPlayedAt,lastPlayedAt])});
  }
  return [...records.values()];
}
export function displayDate(value){
  const date=dateValue(value);if(!date)return '尚無日期';
  if(date.length===10)return date.replaceAll('-','/');
  return new Date(date).toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
