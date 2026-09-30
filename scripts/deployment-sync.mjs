#!/usr/bin/env node

// Dependency-free helpers used by the static GitHub Pages repository.
//
//   node scripts/deployment-sync.mjs prepare --commit "$GITHUB_SHA"
//   node scripts/deployment-sync.mjs stage-site --output .pages-site
//   node scripts/deployment-sync.mjs notify --site-url "$PAGES_URL"
//
// `prepare` stamps the checked-out static repository revision into the public
// manifest. `stage-site` copies a strict allowlist into the Pages artifact.
// `notify` runs only after deploy-pages succeeds, waits for the public CDN to
// serve that exact manifest, then asks Supabase to verify and record it.

import {createHash} from 'node:crypto';
import {cp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const STATIC_FILES=['index.html','favicon.svg','scene-manifest.json','static-build.json','robots.txt','manifest.webmanifest'];
const STATIC_DIRS=['assets','data','fonts','models','photos','textures'];
const SECRET_OR_SOURCE_DIRS=new Set(['.git','.github','node_modules','scripts','docs','supabase','.tools']);

export function stableStringify(value){
  if(value===undefined)return 'null';
  if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function layoutHashPayload(entities){
  if(!entities||typeof entities!=='object'||Array.isArray(entities))throw new Error('scene-index.json must contain an entities object.');
  const payload={};
  for(const id of Object.keys(entities).sort()){
    const row=entities[id];
    if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`Invalid scene entity: ${id}`);
    if(typeof row.type!=='string'||typeof row.model!=='string'||!row.base_state||typeof row.base_state!=='object'||Array.isArray(row.base_state)){
      throw new Error(`Scene entity ${id} is missing type, model, or base_state.`);
    }
    payload[id]={id,type:row.type,model:row.model,base_state:row.base_state};
  }
  return payload;
}

export function calculateLayoutHash(index){
  const payload=layoutHashPayload(index?.entities);
  return createHash('sha256').update(stableStringify(payload),'utf8').digest('hex');
}

export function readPublishedRevision(plantingEdits){
  const revision=plantingEdits?.meta?.publishedRevision??0;
  if(!Number.isSafeInteger(revision)||revision<0)throw new Error('planting-edits.json meta.publishedRevision must be a non-negative integer.');
  return revision;
}

function validateBuildInputs(index,plantingEdits){
  const layoutHash=calculateLayoutHash(index);
  if(typeof index.layoutHash!=='string'||index.layoutHash!==layoutHash){
    throw new Error('data/scene-index.json layoutHash does not match its canonical entities.');
  }
  return {layoutHash,publishedRevision:readPublishedRevision(plantingEdits)};
}

async function readJson(path,label){
  let value;
  try{value=JSON.parse(await readFile(path,'utf8'));}
  catch(error){throw new Error(`Cannot read ${label} as JSON (${error.code||'invalid JSON'}).`);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} must contain a JSON object.`);
  return value;
}

export async function prepareManifest({root=process.cwd(),gitCommit,generatedAt=new Date().toISOString()}={}){
  if(typeof gitCommit!=='string'||!/^[a-f0-9]{7,64}$/i.test(gitCommit.trim())){
    throw new Error('A static repository commit SHA of 7 to 64 hexadecimal characters is required.');
  }
  const base=resolve(root);
  const [index,edits]=await Promise.all([
    readJson(join(base,'data','scene-index.json'),'data/scene-index.json'),
    readJson(join(base,'data','planting-edits.json'),'data/planting-edits.json')
  ]);
  const {layoutHash,publishedRevision}=validateBuildInputs(index,edits);
  const manifest={gitCommit:gitCommit.trim(),layoutHash,publishedRevision,generatedAt};
  await writeFile(join(base,'scene-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');

  // Re-read what will be served and make the release metadata equality explicit.
  const written=await readJson(join(base,'scene-manifest.json'),'scene-manifest.json');
  if(written.gitCommit!==gitCommit.trim()||written.layoutHash!==layoutHash||written.publishedRevision!==publishedRevision){
    throw new Error('scene-manifest.json does not match the deployed source and Published edits.');
  }
  return written;
}

function ensureSafeOutput(root,output){
  if(output!=='.pages-site')throw new Error('Pages artifact output is fixed at .pages-site to protect the checkout.');
  const target=resolve(root,output);
  const rel=relative(resolve(root),target);
  if(!rel||rel==='.'||rel.startsWith('..')||isAbsolute(rel))throw new Error(`Unsafe Pages artifact output path: ${target}`);
  return target;
}

async function copyPublicTree(source,target,{excludeLegacyEditor=false}={}){
  await mkdir(target,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(entry.name.startsWith('.')||SECRET_OR_SOURCE_DIRS.has(entry.name))continue;
    if(excludeLegacyEditor&&entry.name.startsWith('edit-'))continue;
    const from=join(source,entry.name),to=join(target,entry.name);
    if(entry.isDirectory())await copyPublicTree(from,to,{excludeLegacyEditor});
    else if(entry.isFile())await cp(from,to);
    // Symlinks and other filesystem entries are not deployable site content.
  }
}

export async function stageSite({root=process.cwd(),output='.pages-site'}={}){
  const base=resolve(root),target=ensureSafeOutput(base,output);
  for(const required of ['index.html','scene-manifest.json','data/scene-index.json','data/planting-edits.json','assets/editor-collaboration.js']){
    if(!existsSync(join(base,required)))throw new Error(`Static Pages source is missing required file: ${required}`);
  }
  const manifest=await readJson(join(base,'scene-manifest.json'),'scene-manifest.json');
  const index=await readJson(join(base,'data','scene-index.json'),'data/scene-index.json');
  const edits=await readJson(join(base,'data','planting-edits.json'),'data/planting-edits.json');
  const html=await readFile(join(base,'index.html'),'utf8');
  const absolute=[...html.matchAll(/(?:src|href)="(\/[^\"]*)"/g)].map(match=>match[1]);
  if(absolute.length)throw new Error(`index.html contains root-absolute paths that fail under /hpsf-campus/: ${absolute.join(', ')}`);
  const contract=validateBuildInputs(index,edits);
  if(manifest.layoutHash!==contract.layoutHash||manifest.publishedRevision!==contract.publishedRevision||typeof manifest.gitCommit!=='string'||!manifest.gitCommit){
    throw new Error('scene-manifest.json does not match scene-index.json and Published edits.');
  }
  await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  await mkdir(target,{recursive:true});
  for(const name of STATIC_FILES){
    const from=join(base,name);
    if(existsSync(from))await cp(from,join(target,name));
  }
  for(const name of STATIC_DIRS){
    const from=join(base,name);
    if(existsSync(from))await copyPublicTree(from,join(target,name),{excludeLegacyEditor:name==='assets'});
  }
  await writeFile(join(target,'.nojekyll'),'','utf8');
  for(const required of ['index.html','scene-manifest.json','data/scene-index.json','data/planting-edits.json','assets/editor-collaboration.js']){
    if(!existsSync(join(target,required)))throw new Error(`Pages artifact is missing required file: ${required}`);
  }
  return target;
}

const sleep=milliseconds=>new Promise(resolveSleep=>setTimeout(resolveSleep,milliseconds));
const withSlash=value=>value.endsWith('/')?value:`${value}/`;

function validHttpUrl(value,label,{httpsOnly=false}={}){
  let parsed;
  try{parsed=new URL(value);}catch{throw new Error(`${label} must be a valid URL.`);}
  if(!['https:','http:'].includes(parsed.protocol)||(httpsOnly&&parsed.protocol!=='https:')||parsed.username||parsed.password){
    throw new Error(`${label} must be an ${httpsOnly?'HTTPS':'HTTP(S)'} URL without embedded credentials.`);
  }
  return parsed;
}

async function fetchPublishedManifest(siteUrl,fetchImpl=fetch,timeoutMs=15000){
  const base=validHttpUrl(withSlash(siteUrl),'GitHub Pages URL',{httpsOnly:true});
  base.search='';base.hash='';
  const url=new URL('scene-manifest.json',base);
  url.searchParams.set('deployment-check',`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const response=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(timeoutMs),headers:{'Cache-Control':'no-cache, no-store','Pragma':'no-cache'}});
  if(!response.ok)return {status:response.status};
  try{return {manifest:await response.json(),status:response.status};}
  catch{return {status:response.status,invalidJson:true};}
}

export async function waitForManifest({siteUrl,expected,attempts=12,intervalMs=10000,timeoutMs=15000,fetchImpl=fetch,sleepImpl=sleep}={}){
  if(!Number.isInteger(attempts)||attempts<1)throw new Error('Manifest retry attempts must be positive.');
  let last='not available';
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const result=await fetchPublishedManifest(siteUrl,fetchImpl,timeoutMs);
      if(result.manifest&&result.manifest.gitCommit===expected.gitCommit&&result.manifest.layoutHash===expected.layoutHash&&result.manifest.publishedRevision===expected.publishedRevision){
        return result.manifest;
      }
      last=result.status===undefined?'invalid response':`HTTP ${result.status}${result.invalidJson?' (invalid JSON)':''}`;
      if(result.manifest)last='manifest has not reached the deployed commit/revision yet';
    }catch(error){last=error?.name==='TypeError'?'network or URL error':'fetch failed';}
    if(attempt<attempts)await sleepImpl(intervalMs);
  }
  throw new Error(`GitHub Pages manifest did not match this deployment after ${attempts} attempts (${last}).`);
}

export async function notifyDeployment({root=process.cwd(),siteUrl,endpoint,secret,attempts=12,intervalMs=10000,timeoutMs=15000,fetchImpl=fetch,sleepImpl=sleep}={}){
  if(!endpoint||!secret)throw new Error('Both SUPABASE_DEPLOYMENT_SYNC_URL and DEPLOYMENT_SECRET are required for sync.');
  const endpointUrl=validHttpUrl(endpoint,'Supabase deployment-sync URL',{httpsOnly:true});
  if(!endpointUrl.pathname.endsWith('/functions/v1/deployment-sync'))throw new Error('Supabase deployment-sync URL must end in /functions/v1/deployment-sync.');
  const expected=await readJson(join(resolve(root),'scene-manifest.json'),'scene-manifest.json');
  if(typeof expected.gitCommit!=='string'||typeof expected.layoutHash!=='string'||!Number.isSafeInteger(expected.publishedRevision)){
    throw new Error('scene-manifest.json is missing deployment identity fields.');
  }
  await waitForManifest({siteUrl,expected,attempts,intervalMs,timeoutMs,fetchImpl,sleepImpl});
  const response=await fetchImpl(endpointUrl,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),headers:{'Content-Type':'application/json','x-deployment-secret':secret},body:JSON.stringify({gitCommit:expected.gitCommit,layoutHash:expected.layoutHash,publishedRevision:expected.publishedRevision})});
  if(!response.ok)throw new Error(`Supabase deployment-sync rejected the verified Pages manifest (HTTP ${response.status}).`);
  console.log(`Supabase deployment sync accepted for revision ${expected.publishedRevision}.`);
  return {gitCommit:expected.gitCommit,layoutHash:expected.layoutHash,publishedRevision:expected.publishedRevision};
}

function parseOptions(args){
  const output={};
  for(let i=0;i<args.length;i++){
    const item=args[i];
    if(!item.startsWith('--'))throw new Error(`Unexpected argument: ${item}`);
    const key=item.slice(2);
    const value=args[++i];
    if(!value||value.startsWith('--'))throw new Error(`Missing value for --${key}`);
    output[key]=value;
  }
  return output;
}

async function main(argv){
  const [command,...rest]=argv;
  const options=parseOptions(rest);
  const root=resolve(options.root||process.cwd());
  if(command==='prepare'){
    const manifest=await prepareManifest({root,gitCommit:options.commit||process.env.GITHUB_SHA});
    console.log(`Prepared scene-manifest.json for ${manifest.gitCommit} (Published revision ${manifest.publishedRevision}).`);
    return;
  }
  if(command==='stage-site'){
    const target=await stageSite({root,output:options.output||'.pages-site'});
    console.log(`Staged the public Pages files into ${relative(root,target)}.`);
    return;
  }
  if(command==='notify'){
    const endpoint=process.env.SUPABASE_DEPLOYMENT_SYNC_URL||'';
    const secret=process.env.DEPLOYMENT_SECRET||'';
    if(!endpoint&&!secret){
      console.log('Supabase deployment sync skipped; GitHub secrets are not configured.');
      return;
    }
    await notifyDeployment({root,siteUrl:options['site-url']||process.env.PAGES_URL,endpoint,secret});
    return;
  }
  throw new Error('Usage: deployment-sync.mjs <prepare|stage-site|notify> [options]');
}

const isMain=process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url));
if(isMain)main(process.argv.slice(2)).catch(error=>{
  // Never print environment values, request headers, or response bodies here.
  console.error(`Deployment workflow helper failed: ${error.message}`);
  process.exitCode=1;
});
