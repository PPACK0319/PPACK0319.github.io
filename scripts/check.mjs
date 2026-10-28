import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const errors=[];
const check=(condition,message)=>{if(!condition)errors.push(message);};
const exists=async(path)=>{try{return (await stat(path)).isFile();}catch{return false;}};
const html=await readFile(join(dist,'index.html'),'utf8');
const code=await readFile(join(dist,'content.js'),'utf8');
const context={window:{}};
runInNewContext(code,context,{timeout:1000});
const data=context.window.PORTFOLIO_CONTENT;
check(data.experiences?.length>0,'No experiences');
const ids=data.experiences.map(x=>x.id);
check(new Set(ids).size===ids.length,'Duplicate experience IDs');
check(data.experiences.some(x=>x.hrd),'Default HRD filter has no experiences');
check(data.profile.englishName==='Park JungHun','Profile English name does not match the confirmed spelling');
for(const match of html.matchAll(/data-experience="([^"]+)"/g))check(ids.includes(match[1]),`Hero has no target: ${match[1]}`);
for(const exp of data.experiences){
  check(['competition','activity','work'].includes(exp.type),`Invalid type: ${exp.id}`);
  for(const key of ['title','period','summary','role'])check(typeof exp[key]==='string'&&exp[key].trim(),`Missing ${key}: ${exp.id}`);
  if(exp.hrd)check(Boolean(exp.hrdLabel?.trim()&&exp.hrdFocus?.trim()),`Missing HRD context: ${exp.id}`);
  for(const part of exp.detailSections??[]){
    check(Boolean(part.title?.trim()),`Missing detail section title: ${exp.id}`);
    check(Array.isArray(part.items)&&part.items.length>0&&part.items.every(x=>typeof x==='string'&&x.trim()),`Invalid detail section items: ${exp.id}`);
  }
  for(const img of exp.images??[]){
    check(/^\.\/assets\/media\/[a-zA-Z0-9._/-]+$/.test(img.src),`Unsafe image path: ${exp.id}`);
    check(await exists(resolve(dist,img.src)),`Missing image ${img.src}`);
    check(Boolean(img.alt),`Missing image alt: ${exp.id}`);
    check(Number(img.width)>0&&Number(img.height)>0,`Missing image ratio: ${exp.id}/${img.src}`);
    if(img.kind)check(['photo','slide'].includes(img.kind),`Invalid image kind: ${exp.id}`);
  }
  const groups=exp.detailGroups??[];
  check(groups.length>0,`Missing structured detail: ${exp.id}`);
  check(new Set(groups.map(group=>group.id)).size===groups.length,`Duplicate detail group: ${exp.id}`);
  const mediaNames=new Set((exp.images??[]).map(img=>img.src.split('/').pop()));
  for(const group of groups){
    check(Boolean(group.id?.trim()&&group.label?.trim()&&group.role?.trim()),`Missing detail group heading or role: ${exp.id}`);
    check(group.sections?.length>0,`Empty detail group: ${exp.id}/${group.id}`);
    for(const part of group.sections??[])check(Boolean(part.title?.trim()&&part.items?.length&&part.items.every(item=>typeof item==='string'&&item.trim())),`Invalid structured section: ${exp.id}/${group.id}`);
    for(const part of group.sections??[])if(part.subsections?.length){
      check(part.subsections.every(sub=>sub.title?.trim()&&sub.items?.length),`Invalid work subsection: ${exp.id}/${group.id}`);
      check(JSON.stringify(part.items)===JSON.stringify(part.subsections.flatMap(sub=>sub.items)),`Work grouping lost source items: ${exp.id}/${group.id}`);
    }
    check(new Set(group.imageFiles??[]).size===(group.imageFiles??[]).length,`Duplicate group image: ${exp.id}/${group.id}`);
    for(const name of group.imageFiles??[])check(mediaNames.has(name),`Unmapped group image: ${exp.id}/${group.id}/${name}`);
  }
  if(exp.detailCollection){
    check(JSON.stringify(exp.detailCollection.experienceIds)===JSON.stringify(groups.map(group=>group.id)),`Collection tabs mismatch: ${exp.id}`);
    for(const id of exp.detailCollection.experienceIds)check(data.awards.some(award=>award.experienceId===id)&&data.experiences.some(item=>item.id===id&&item.type==='competition'),`Unawarded item in competition collection: ${id}`);
  }
}
check(JSON.stringify(data.experiences.find(exp=>exp.id==='kcci')?.detailGroups.map(group=>group.id))===JSON.stringify(['team-mate','camp','education']),'Internship activity groups do not match the confirmed structure');
check(!data.experiences.some(exp=>(exp.images??[]).some(img=>img.src.endsWith('team-mate-stage.webp')||img.src.endsWith('team-mate-logo-v10.png'))),'Replaced Team-Mate media is still referenced');
for(const award of data.awards)check(award.profile===true||ids.includes(award.experienceId),`Award has no target: ${award.title}`);
for(const row of data.journey)if(row.experienceId)check(ids.includes(row.experienceId),`Journey has no target: ${row.title}`);
for(const link of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))check(await exists(resolve(dist,link[1])),`Missing HTML asset: ${link[1]}`);
const walk=async(dir)=>{const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())files.push(...await walk(path));else files.push(path);}return files;};
const files=await walk(dist);
const restrictedMedia=['geocup-proposal.webp','gwangjin-context.webp','gwangjin-result.webp','gyeongnam-context.webp','gyeongnam-map.webp','gyeongnam-method.webp','gyeongnam-presentation-photo.webp','shinhan-insight-presentation-photo.webp','shinhan-insight.webp','shinhan-promotion.webp','veterans-context.webp','veterans-map.webp','veterans-method.webp','veterans-presentation-photo.webp','yeongcheon-context.webp','yeongcheon-cover.webp','yeongcheon-map.webp','yeongcheon-presentation-photo.webp','yeongcheon-process.webp'];
for(const filename of restrictedMedia){
  check(!files.some(path=>path.endsWith('/'+filename)||path.endsWith('\\'+filename)),`Unredacted original in public folder: ${filename}`);
  check(!code.includes(filename),`Unredacted source still linked: ${filename}`);
}
check(!files.some(x=>/\.(pdf|docx|hwpx|hwp|xlsx|zip|sqlite|env)$/i.test(x)),'Private or source document found in dist');
check(!/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(code),'Private phone number found in content');
check(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(code),'Email address found in content');
check(!/여권번호|주민등록번호|학번\s*[:：]/.test(code),'Sensitive identifier found in content');
check(!/internal_review|source_ids|download_url|file_uri/.test(code),'Internal source metadata found in public content');
const assets=files.filter(x=>x.endsWith('.woff2'));
for(const asset of assets){const b=await readFile(asset);check(b.subarray(0,4).toString()==='wOF2',`Invalid font: ${asset}`);}
if(errors.length){process.stderr.write(errors.join('\n')+'\n');process.exit(1);}
process.stdout.write(JSON.stringify({status:'passed',experiences:ids.length,awards:data.awards.length,files:files.length,fonts:assets.length,source_documents_in_dist:0},null,2)+'\n');
