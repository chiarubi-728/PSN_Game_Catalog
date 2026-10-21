import {titleKey,verifiedDisplayTitleGroups,verifiedProductTitleGroups} from './title-aliases.js';
import {cleanStoreTitle} from './store-names.js';

const hasChinese=name=>/\p{Script=Han}/u.test(name);
const displayKey=name=>titleKey(cleanStoreTitle(name)).replace(/\s/g,'');

// Build a display-only index from exact, documented title equivalences.
// Keep product editions intact and never use concept titles as edition aliases.
export function localizeCatalogNames(cards,storeNames){
  const localized=new Map(),knownNames=new Map();
  const products=new Map(verifiedProductTitleGroups.map(group=>[group.productId,group]));
  for(const group of verifiedDisplayTitleGroups){
    const preferred=group.names.find(hasChinese);
    for(const name of group.names){const key=displayKey(name);if(!knownNames.has(key))knownNames.set(key,new Set());knownNames.get(key).add(preferred);}
  }
  function addGroup(rawNames,preferred){
    const names=[...new Set(rawNames.map(cleanStoreTitle).filter(Boolean))];
    const name=preferred?cleanStoreTitle(preferred):names.find(hasChinese);
    if(!name||!hasChinese(name))return;
    for(const alias of names){
      const key=displayKey(alias);if(!key)continue;
      if(!localized.has(key))localized.set(key,new Map());
      const candidates=localized.get(key);
      if(!candidates.has(name))candidates.set(name,new Set());
      for(const other of names)candidates.get(name).add(other);
    }
  }
  for(const group of verifiedDisplayTitleGroups)addGroup(group.names);
  for(const card of cards)for(const member of card.digitalMembers){
    if(products.has(member.productId?.trim().toUpperCase()))continue;
    const record=storeNames?.records?.[member.productId?.trim().toUpperCase()];
    const productNames=(record?.names||[]).filter(item=>item.type==='product'||item.type==='invariant').map(item=>item.name);
    const original=cleanStoreTitle(member.name);
    const known=knownNames.get(displayKey(original));
    const preferred=known?.size===1?[...known][0]:hasChinese(original)?original:undefined;
    addGroup([member.name,...productNames],preferred);
  }
  return cards.map(card=>{
    const identities=card.digitalMembers.map(member=>products.get(member.productId?.trim().toUpperCase()));
    const identity=identities[0];
    if(identity&&identities.every(group=>group===identity)){
      const name=identity.names.find(hasChinese),preferred=displayKey(name);
      const originalNames=card.names.filter(alias=>{const known=knownNames.get(displayKey(alias));return !known||known.size===1&&displayKey([...known][0])===preferred;});
      return {...card,name,names:[...new Set([name,...identity.names,...originalNames])]};
    }
    const candidates=localized.get(displayKey(card.name));
    // Conflicting localized names stay as received rather than guessing.
    if(candidates?.size!==1)return card;
    const [name,aliases]=candidates.entries().next().value;
    return {...card,name,names:[...new Set([name,...aliases,...card.names])]};
  });
}
