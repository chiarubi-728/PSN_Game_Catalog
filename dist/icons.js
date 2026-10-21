// Small local SVGs; no icon package, network request or official artwork needed.
const paths = {
  'ps-plus':[['path',{d:'M8.5 2.5h7v6h6v7h-6v6h-7v-6h-6v-7h6z',fill:'currentColor',stroke:'none'}],['path',{d:'m12 4.3-1.4 2.4h2.8zM4.6 10.7h2.2v2.2H4.6zM17.1 10.7l2.2 2.2m0-2.2-2.2 2.2',stroke:'#80641d','stroke-width':'.75'}],['circle',{cx:12,cy:18.1,r:1.15,stroke:'#80641d','stroke-width':'.75'}]],
  trophy:[['path',{d:'M8 3h8v6a4 4 0 0 1-8 0V3Z'}],['path',{d:'M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4v3h-4z'}]],
  'circle-x':[['circle',{cx:12,cy:12,r:9}],['path',{d:'m9 9 6 6m0-6-6 6'}]],
  bookmark:[['path',{d:'M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z'}]],
};
export function icon(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'classification-icon'}))svg.setAttribute(key,value);
  if(name==='ps-plus')svg.classList.add('ps-plus-icon');
  for(const [tag,attributes] of paths[name]||[]){const child=document.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))child.setAttribute(key,value);svg.append(child);}
  return svg;
}
