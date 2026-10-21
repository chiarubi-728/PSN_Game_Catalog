import {titleKey,verifiedDisplayTitleGroups} from './title-aliases.js';
import {cleanStoreTitle} from './store-names.js';

const hasChinese=name=>/\p{Script=Han}/u.test(name);

// Build a display-only index from exact, documented title equivalences.
// Keep product editions intact and never use concept titles as edition aliases.
export function localizeCatalogNames(cards,storeNames){
  const localized=new Map();
  function addGroup(rawNames,preferred){
    const names=[...new Set(rawNames.map(cleanStoreTitle).filter(Boolean))];
    const name=preferred?cleanStoreTitle(preferred):names.find(hasChinese);
    if(!name||!hasChinese(name))return;
    for(const alias of names){
      const key=titleKey(alias);if(!key)continue;
      if(!localized.has(key))localized.set(key,new Map());
      const candidates=localized.get(key);
      if(!candidates.has(name))candidates.set(name,new Set());
      for(const other of names)candidates.get(name).add(other);
    }
  }
  for(const group of verifiedDisplayTitleGroups)addGroup(group.names);
  for(const card of cards)for(const member of card.digitalMembers){
    const record=storeNames?.records?.[member.productId?.trim().toUpperCase()];
    const productNames=(record?.names||[]).filter(item=>item.type==='product'||item.type==='invariant').map(item=>item.name);
    const original=cleanStoreTitle(member.name);
    addGroup([member.name,...productNames],hasChinese(original)?original:undefined);
  }
  return cards.map(card=>{
    const candidates=localized.get(titleKey(cleanStoreTitle(card.name)));
    // Conflicting localized names stay as received rather than guessing.
    if(candidates?.size!==1)return card;
    const [name,aliases]=candidates.entries().next().value;
    return {...card,name,names:[...new Set([name,...aliases,...card.names])]};
  });
}
