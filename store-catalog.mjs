const productPattern=/^[A-Z]{2}\d{4}-[A-Z0-9]{9}_\d{2}-[A-Z0-9_]{1,32}$/;
const conceptPattern=/^\d{1,12}$/;
const cache=new Map(),pending=new Map(),waiters=[];let active=0;
const error=code=>Object.assign(Error(code),{code});
function safeItem(raw){
  if(!raw||typeof raw!=='object'||!productPattern.test(raw.productId||'')||raw.conceptId!==undefined&&!conceptPattern.test(raw.conceptId))throw error('INVALID_PRODUCT');
  return {productId:raw.productId,...(raw.conceptId?{conceptId:raw.conceptId}:{})};
}
async function slot(action){
  if(active<2)active++;else await new Promise(resolve=>waiters.push(resolve));
  try{return await action();}finally{const next=waiters.shift();if(next)next();else active--;}
}
async function publicHtml(url){
  let current=url;
  for(let redirect=0;redirect<3;redirect++){
    const target=new URL(current);
    if(target.origin!=='https://store.playstation.com'||!/^\/(?:en-tw|en-hk|en-us|en-gb|ja-jp)\/(?:product|concept)\/[A-Za-z0-9_-]+\/?$/.test(target.pathname)||target.search||target.hash)throw error('INVALID_STORE_URL');
    let response;try{response=await fetch(target,{redirect:'manual',credentials:'omit',headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});}catch{throw error('STORE_UNAVAILABLE');}
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');await response.body?.cancel();if(!location)throw error('STORE_UNAVAILABLE');current=new URL(location,target).href;continue;
    }
    if(response.status===404){await response.body?.cancel();throw error('NOT_FOUND');}
    if(response.status!==200){await response.body?.cancel();throw error(response.status===429?'RATE_LIMITED':'STORE_UNAVAILABLE');}
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>6000000)throw error('STORE_RESPONSE_TOO_LARGE');chunks.push(chunk);}
    return {html:Buffer.concat(chunks).toString('utf8'),url:target.href};
  }
  throw error('STORE_UNAVAILABLE');
}
function parseCatalog(html,item,mode){
  const cache={},products=[];
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(!/\btype\s*=\s*["']application\/json["']/i.test(match[1]))continue;
    let data;try{data=JSON.parse(match[2]);}catch{continue;}
    const scope=mode==='product'?data.args?.productId===item.productId:String(data.args?.conceptId||'')===item.conceptId;
    if(!scope)continue;
    for(const [key,node] of Object.entries(data.cache||{}))if(node&&typeof node==='object')cache[key]={...cache[key],...node};
  }
  const product=Object.values(cache).find(node=>node.__typename==='Product'&&node.id===item.productId);
  if(mode==='product'&&!product)throw error('STORE_FORMAT_CHANGED');
  const conceptId=mode==='product'?/^Concept:(\d+)$/.exec(product.concept?.__ref||'')?.[1]:item.conceptId;
  const concept=conceptId?Object.values(cache).find(node=>node.__typename==='Concept'&&String(node.id)===conceptId):null;
  if(mode==='concept'&&(!concept||!concept.name))throw error('STORE_FORMAT_CHANGED');
  if(product)products.push(product);
  const special=product&&/friend.?s\s*pass|\btrial\b|\bdemo\b|\bupgrade\b|\bcollection\b|\bbundle\b|通行證|試玩|升級|合輯|合集|同捆/i.test([product.invariantName,product.name].filter(Boolean).join(' '));
  const names=[];
  if(product?.name)names.push({name:product.name,type:'product'});
  if(product?.invariantName)names.push({name:product.invariantName,type:'invariant'});
  if(concept?.name&&!special)names.push({name:concept.name,type:'concept'});
  if(!names.length)throw error('STORE_FORMAT_CHANGED');
  const platforms=[...new Set(products.flatMap(node=>node.platforms||[]))].filter(value=>['PS3','PS4','PS5','PSVITA','PC'].includes(value));
  return {productId:item.productId,...(conceptId?{conceptId}:{}),names,platforms};
}
async function resolveItem(item){
  const locale=({UP:'en-us',EP:'en-gb',HP:'en-hk',JP:'ja-jp'})[item.productId.slice(0,2)]||'en-tw';
  let firstError;
  try{
    const page=await publicHtml('https://store.playstation.com/'+locale+'/product/'+item.productId),record=parseCatalog(page.html,item,'product');
    return {...record,locale,sourceUrls:[page.url],updatedAt:new Date().toISOString()};
  }catch(e){firstError=e;if(e.code==='RATE_LIMITED')throw e;}
  if(item.conceptId){
    const page=await publicHtml('https://store.playstation.com/en-tw/concept/'+item.conceptId),record=parseCatalog(page.html,item,'concept');
    return {...record,locale:'en-tw',sourceUrls:[page.url],updatedAt:new Date().toISOString()};
  }
  throw firstError;
}
async function lookup(item){
  const key=item.productId+':'+(item.conceptId||''),stored=cache.get(key);
  if(stored&&Date.now()-stored.at<86400000)return stored.record;
  if(pending.has(key))return pending.get(key);
  const job=slot(()=>resolveItem(item));pending.set(key,job);
  try{const record=await job;if(cache.size>5000)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),record});return record;}finally{pending.delete(key);}
}
export async function serveStoreCatalog(req,res,port){
  if(!req.url?.startsWith('/api/store-names'))return false;
  const host=req.headers.host,origins=new Set(['http://localhost:'+port,'http://127.0.0.1:'+port]);
  const reply=(status,value)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  if(!['localhost:'+port,'127.0.0.1:'+port].includes(host)||req.headers.origin&&!origins.has(req.headers.origin)){reply(403,{error:'FORBIDDEN'});return true;}
  if(req.method==='GET'&&req.url==='/api/store-names'){reply(200,{ready:true,schemaVersion:1,provider:'Sony public store'});return true;}
  if(req.method!=='POST'||req.url!=='/api/store-names'){reply(404,{error:'NOT_FOUND'});return true;}
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json'){reply(415,{error:'CONTENT_TYPE'});return true;}
  try{
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw error('INVALID_REQUEST');chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!Array.isArray(body.products)||!body.products.length||body.products.length>4)throw error('INVALID_REQUEST');
    const products=[...new Map(body.products.map(safeItem).map(item=>[item.productId,item])).values()];
    const results=await Promise.allSettled(products.map(lookup)),records=[],failures=[];
    results.forEach((result,index)=>{if(result.status==='fulfilled')records.push(result.value);else failures.push({productId:products[index].productId,error:['NOT_FOUND','RATE_LIMITED','STORE_UNAVAILABLE','STORE_FORMAT_CHANGED','STORE_RESPONSE_TOO_LARGE'].includes(result.reason?.code)?result.reason.code:'STORE_UNAVAILABLE'});});
    reply(200,{schemaVersion:1,records,failures});
  }catch{reply(400,{error:'INVALID_REQUEST'});}
  return true;
}
