import {personalPlatinum} from './model.js';

export function progressRange(minInput,maxInput){
  const values=[minInput,maxInput].map(input=>input.value===''?null:Number(input.value));
  const [min,max]=values,invalid=[minInput,maxInput].some(input=>input.validity.badInput)||values.some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>100))||min!==null&&max!==null&&min>max;
  return {min,max,invalid,active:invalid||min!==null||max!==null};
}
export function cycleFilter(value,included,excluded){
  if(included.delete(value)){excluded.add(value);return 'exclude';}
  if(excluded.delete(value))return 'none';included.add(value);return 'include';
}
export function matchesBrowseFilters(game,record,{marks,categories,progress,platforms=new Set(),excludedPlatforms=new Set(),excludedMarks=new Set()}){
  if(game.platforms?.some(platform=>excludedPlatforms.has(platform)))return false;
  if(platforms.size&&!game.platforms?.some(platform=>platforms.has(platform)))return false;
  if(progress.invalid)return false;
  if(progress.active&&(game.progress===null||!Number.isFinite(game.progress)||progress.min!==null&&game.progress<progress.min||progress.max!==null&&game.progress>progress.max))return false;
  const matchesMark=value=>value==='已白金'?game.platinum||personalPlatinum(record):record.status===value;
  if([...excludedMarks].some(matchesMark))return false;
  if(marks.size&&![...marks].some(matchesMark))return false;
  return !categories.size||record.categories.some(name=>categories.has(name));
}
