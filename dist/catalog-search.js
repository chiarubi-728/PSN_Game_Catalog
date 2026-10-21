import {titleKey,verifiedSearchSeries} from './title-aliases.js';
import {cleanStoreTitle} from './store-names.js';

// Search may ignore spacing and title brackets without loosening source matching.
export const catalogSearchKey=value=>titleKey(value).replace(/[《》「」『』\s]/g,'');

export function matchesCatalogSearch(names,query){
  const key=catalogSearchKey(query);if(!key)return true;
  for(const name of names){
    if(catalogSearchKey(name).includes(key))return true;
    const title=titleKey(cleanStoreTitle(name));
    for(const series of verifiedSearchSeries)for(const alias of series.names){
      const prefix=titleKey(alias);if(!title.startsWith(prefix))continue;
      const suffix=title.slice(prefix.length);
      // Do not interpret Battlefieldsomething as a Battlefield series title.
      if(/^[a-z]/i.test(suffix))continue;
      for(const replacement of series.names)if(catalogSearchKey(replacement+suffix).includes(key))return true;
    }
  }
  return false;
}
