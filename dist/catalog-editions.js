import {platformWorkKey} from './model.js';

// Documented language editions of the same platform work. This groups ownership
// for display, not individual license usage or trophy-set identity. All source
// entitlements and trophy lists remain separate. Unknown products never qualify.
export const verifiedEditionGroups=[{
  id:'cod-modern-warfare-remastered',platform:'PS4',
  name:'Call of Duty: Modern Warfare Remastered',
  productIds:[
    'HP0002-CUSA05373_00-CODMWRTHEGAME001',
    'UP0002-CUSA03522_00-ASIAWRTHEGAME001',
  ],
  sources:[
    'https://store.playstation.com/en-tw/product/HP0002-CUSA05373_00-CODMWRTHEGAME001',
    'https://store.playstation.com/en-tw/product/UP0002-CUSA03522_00-ASIAWRTHEGAME001',
  ],
}];

export function groupVerifiedEditions(cards){
  const grouped=new Map(),remaining=[];
  for(const card of cards){
    const group=verifiedEditionGroups.find(item=>card.platforms.length===1&&card.platforms[0]===item.platform&&card.digitalMembers.length&&card.digitalMembers.every(member=>item.productIds.includes(member.productId?.trim().toUpperCase())));
    if(!group){remaining.push(card);continue;}
    if(!grouped.has(group))grouped.set(group,[]);grouped.get(group).push(card);
  }
  for(const [group,sources] of grouped){
    sources.sort((a,b)=>Number(b.digitalOwned)-Number(a.digitalOwned)||a.key.localeCompare(b.key));
    const members=sources.flatMap(card=>card.digitalMembers);
    remaining.push({...sources[0],name:group.name,
      key:platformWorkKey('identity:'+group.id,group.platform),baseKey:'identity:'+group.id,
      members,digitalMembers:members,baseMembers:sources.flatMap(card=>card.baseMembers||card.members),
      digitalOwned:sources.some(card=>card.digitalOwned),missingCount:sources.reduce((count,card)=>count+card.missingCount,0),
      officialNames:[...new Set([group.name,...sources.flatMap(card=>card.officialNames||[])])],
      imageUrl:sources.find(card=>card.imageUrl)?.imageUrl,
      sourceWorkKeys:sources.map(card=>card.key),sourceWorks:sources,
    });
  }
  return remaining;
}
