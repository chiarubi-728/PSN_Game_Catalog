import {personalPlatinum} from './model.js';

export function progressRange(minInput,maxInput){
  const values=[minInput,maxInput].map(input=>input.value===''?null:Number(input.value));
  const [min,max]=values,invalid=[minInput,maxInput].some(input=>input.validity.badInput)||values.some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>100))||min!==null&&max!==null&&min>max;
  return {min,max,invalid,active:invalid||min!==null||max!==null};
}
export function matchesBrowseFilters(game,record,{marks,categories,progress}){
  if(progress.invalid)return false;
  if(progress.active&&(game.progress===null||!Number.isFinite(game.progress)||progress.min!==null&&game.progress<progress.min||progress.max!==null&&game.progress>progress.max))return false;
  // All classifications form one OR group, including custom categories.
  if(!marks.size&&!categories.size)return true;
  return (marks.has('已白金')&&(game.platinum||personalPlatinum(record)))
    || (record.status!=='已白金'&&marks.has(record.status))
    || record.categories.some(name=>categories.has(name));
}
