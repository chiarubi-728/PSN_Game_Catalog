export const storeProductPattern=/^[A-Z]{2}\d{4}-[A-Z0-9]{9}_\d{2}-[A-Z0-9_]{1,32}$/;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const locales=new Set(['en-us','en-tw','en-hk','en-gb','ja-jp']);
const failureCodes=new Set(['NOT_FOUND','RATE_LIMITED','STORE_UNAVAILABLE','STORE_FORMAT_CHANGED','STORE_RESPONSE_TOO_LARGE']);
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export const emptyStoreNames=()=>({kind:'ps-game-base-store-names',schemaVersion:1,records:{},failures:{}});
export function readStoreNames(input){
  if(input===undefined)return emptyStoreNames();
  if(!object(input)||input.kind!=='ps-game-base-store-names'||input.schemaVersion!==1||!object(input.records)||input.failures!==undefined&&!object(input.failures)||Object.keys(input.records).length>5000||Object.keys(input.failures||{}).length>5000)throw Error('官方名稱對照格式不正確。');
  const records=Object.create(null),failures=Object.create(null);
  for(const [id,row] of Object.entries(input.records)){
    if(!storeProductPattern.test(id)||!object(row)||row.productId!==id||row.conceptId!==undefined&&!/^\d{1,12}$/.test(row.conceptId)||!locales.has(row.locale)||!Array.isArray(row.names)||!row.names.length||row.names.length>8||row.names.some(item=>!object(item)||typeof item.name!=='string'||!item.name.trim()||item.name.length>500||!['product','concept','invariant'].includes(item.type))||!Array.isArray(row.platforms)||row.platforms.some(p=>!['PS3','PS4','PS5','PSVITA','PC'].includes(p))||!Array.isArray(row.sourceUrls)||!row.sourceUrls.length||row.sourceUrls.length>3||!validTime(row.updatedAt))throw Error('官方商品名稱紀錄不正確。');
    const urls=row.sourceUrls.map(value=>{const url=new URL(value);if(url.origin!=='https://store.playstation.com'||url.username||url.password||url.search||url.hash||![`/${row.locale}/product/${id}`,`/${row.locale}/concept/${row.conceptId}`].includes(url.pathname.replace(/\/$/,'')))throw Error('名稱對照來源不是相同 Sony 商品／作品。');return url.href;});
    records[id]={productId:id,...(row.conceptId?{conceptId:row.conceptId}:{}),locale:row.locale,names:row.names.map(item=>({name:item.name.trim(),type:item.type})),platforms:[...new Set(row.platforms)],sourceUrls:urls,updatedAt:new Date(row.updatedAt).toISOString()};
  }
  for(const [id,row] of Object.entries(input.failures||{})){
    if(!storeProductPattern.test(id)||!object(row)||!failureCodes.has(row.error)||!validTime(row.checkedAt))throw Error('名稱查詢紀錄格式不正確。');
    failures[id]={error:row.error,checkedAt:row.checkedAt};
  }
  return {kind:input.kind,schemaVersion:1,records,failures};
}
export function mergeStoreNames(previous,incoming){
  const before=readStoreNames(previous),after=readStoreNames(incoming),records={...before.records,...after.records},failures={...before.failures,...after.failures};
  for(const id of Object.keys(after.records))delete failures[id];
  return {kind:before.kind,schemaVersion:1,records,failures};
}
export function storeNameRequests(library,data,{retryFailed=false}={}){
  const names=readStoreNames(data),products=new Map();
  for(const game of library.games){
    const productId=game.productId?.trim().toUpperCase();if(!storeProductPattern.test(productId||''))continue;
    if(!products.has(productId))products.set(productId,new Set());
    if(/^\d{1,12}$/.test(game.conceptId||''))products.get(productId).add(game.conceptId);
  }
  return [...products].filter(([id])=>{
    const record=names.records[id],failure=names.failures[id];
    if(record&&Date.now()-Date.parse(record.updatedAt)<30*86400000)return false;
    return retryFailed||!failure||Date.now()-Date.parse(failure.checkedAt)>86400000;
  }).map(([productId,concepts])=>({productId,...(concepts.size===1?{conceptId:[...concepts][0]}:{})}));
}
const languages=new Set(['english','japanese','korean','chinese','simplified chinese','traditional chinese','french','german','spanish','italian','portuguese','russian','polish','arabic','dutch','turkish','czech','hungarian','thai','indonesian','vietnamese','brazilian portuguese','portuguese (brazil)','french (france)','spanish (mexico)','中文','繁體中文','簡體中文','英文','日文','韓文','法文','德文','義大利文','西班牙文','俄文','葡萄牙文']);
export function cleanStoreTitle(value){
  let title=value.normalize('NFKC').replace(/[™®]/g,'').trim();
  title=title.replace(/\(([^()]*)\)\s*$/, (full,body)=>{const tokens=body.split(/[,，、/]+/).map(token=>token.trim().toLowerCase());return tokens.length&&tokens.every(token=>languages.has(token))?'':full;}).trim();
  title=title.replace(/\s*PS[345](?:\s*(?:&|\/|\||and|及|、)\s*PS[345])*(?:\s+(?:Version|Edition)|\s*版本)?\s*$/i,'').trim();
  if(/^《.+》$/.test(title)||/^「.+」$/.test(title))title=title.slice(1,-1).trim();
  return title;
}
export function officialNamesFor(work,data){
  return [...new Set(work.members.flatMap(game=>data?.records?.[game.productId?.trim().toUpperCase()]?.names||[]).map(item=>cleanStoreTitle(item.name)).filter(Boolean))];
}
