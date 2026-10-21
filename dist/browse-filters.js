import {personalPlatinum} from './model.js';

export function progressRange(minInput,maxInput){
  const values=[minInput,maxInput].map(input=>input.value===''?null:Number(input.value));
  const [min,max]=values,invalid=[minInput,maxInput].some(input=>input.validity.badInput)||values.some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>100))||min!==null&&max!==null&&min>max;
  return {min,max,invalid,active:invalid||min!==null||max!==null};
}
export function matchesBrowseFilters(game,record,{marks,categories,progress}){
  if(progress.invalid)return false;
  if(progress.active&&(game.progress===null||!Number.isFinite(game.progress)||progress.min!==null&&game.progress<progress.min||progress.max!==null&&game.progress>progress.max))return false;
  // OR within each group; marks and custom categories narrow each other.
  const matchesMark=!marks.size
    || (marks.has('已白金')&&(game.platinum||personalPlatinum(record)))
    || (record.status!=='已白金'&&marks.has(record.status));
  const matchesCategory=!categories.size||record.categories.some(name=>categories.has(name));
  return matchesMark&&matchesCategory;
}
