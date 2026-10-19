import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {serveStoreCatalog} from './store-catalog.mjs';
const root=path.resolve('dist');
const port=Number(process.env.PORT||4175);
http.createServer(async(req,res)=>{try{if(await serveStoreCatalog(req,res,port))return;const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error();const body=await readFile(file);res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'})[path.extname(file).slice(1)]||'application/octet-stream');res.end(body);}catch{if(!res.headersSent){res.writeHead(404);res.end('Not found');}else res.end();}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
