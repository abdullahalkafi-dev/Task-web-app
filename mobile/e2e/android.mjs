// Runs only on a dedicated emulator. Test sessions use the existing throwaway
// backend's fake-Google verifier; production authentication is never bypassed.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, request as proxyRequest } from 'node:http';
import { createWriteStream, writeFileSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {prepareLegacyDump,legacyDump} from './dump-driver.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apiPort=Number(process.env.DAYFLOW_E2E_API_PORT??4400),apiOrigin=`http://127.0.0.1:${apiPort}`;
const workspace=path.dirname(root),serial=process.env.DAYFLOW_EMULATOR ?? 'emulator-5556';
if(!/^emulator-\d+$/.test(serial))throw new Error('This test requires an isolated emulator, never a physical phone.');
const exec=promisify(execFile),children=[],app='com.dayflow.mobile';
const adbPath=process.platform==='win32' ? path.join(process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA,'Android','Sdk'),'platform-tools','adb.exe') : 'adb';
const output=path.join(root,'test-results','android',serial);await mkdir(output,{recursive:true});
for(const file of ['failure.txt','uncaught.txt','harness-exit.json','runtime-errors.log'])await rm(path.join(output,file),{force:true});
process.on('uncaughtExceptionMonitor',error=>writeFileSync(path.join(output,'uncaught.txt'),error.stack??String(error)));
process.on('exit',code=>writeFileSync(path.join(output,'harness-exit.json'),JSON.stringify({pid:process.pid,code,at:new Date().toISOString()})));
async function adb(...args){return (await exec(adbPath,['-s',serial,...args],{maxBuffer:10*1024*1024,timeout:args.includes('uiautomator')?15000:120000})).stdout.trim();}
async function wait(check,label,timeout=45000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await check();if(value)return value;}catch(e){last=e;}await new Promise(resolve=>setTimeout(resolve,500));}throw new Error(`${label} timed out${last?`: ${last.message}`:''}`);}
function start(name,args,cwd,env={}){const log=createWriteStream(path.join(output,`${name}.log`));const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.once('close',(code,signal)=>{log.end();console.log(`${name} exited: ${code ?? signal}`);});children.push(child);console.log(`Started ${name} (${child.pid})`);return child;}
let online=true;const sockets=new Set();
const proxy=createServer((req,res)=>{if(!online){res.writeHead(503);res.end('Test offline');return;}const upstream=proxyRequest({host:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers:req.headers},reply=>{if(res.destroyed){reply.destroy();return;}res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>{if(res.destroyed)return;if(!res.headersSent)res.writeHead(503);res.end();});req.pipe(upstream);res.on('close',()=>upstream.destroy());});
proxy.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
async function fixture(action,payload){const args=['shell','am','broadcast','-n',`${app}/com.dayflow.nativecore.TestReceiver`,'-a',`dayflow.test.${action}`];if(payload)args.push('--es','payload',Buffer.from(JSON.stringify(payload)).toString('base64url'));await adb(...args);}
async function state(){await fixture('DUMP');return JSON.parse(await adb('shell','run-as',app,'cat','files/e2e-state.json'));}
function nodes(xml){return [...xml.matchAll(/<node\b([^>]+)\/>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2].replaceAll('&amp;','&').replaceAll('&quot;','"')])));}
async function dump(){const result=apiLevel<=33?await legacyDump(adbPath,serial):await adb('shell','uiautomator','dump','/sdcard/dayflow-window.xml');if(!/UI hier(?:archy|chary) dumped to:/.test(result))throw new Error(`Android UI snapshot unavailable: ${result.slice(0,200)}`);return await adb('shell','cat','/sdcard/dayflow-window.xml');}
function matchesLabel(node,label){return [node.text,node['content-desc'],node.hint].some(value=>value?.toLowerCase()===label.toLowerCase());}
async function tap(label,{scroll=false}={}){
  for(let attempt=0;attempt<(scroll?20:12);attempt++){
    const matches=nodes(await dump()).filter(n=>matchesLabel(n,label)&&n.bounds!=='[0,0][0,0]');
    if(matches.length){const n=matches[0],b=[...n.bounds.matchAll(/\d+/g)].map(x=>Number(x[0]));await adb('shell','input','tap',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));return;}
    // Wait for navigation/native state before scrolling. Tabs retain scroll
    // positions, so search from the top too rather than only moving downward.
    if(scroll&&(attempt===3||attempt===4))await adb('shell','input','swipe','500','500','500','1800','300');
    else if(scroll&&attempt>=5&&attempt%2===1)await adb('shell','input','swipe','500','1700','500','800','300');
    else await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error(`UI control not found: ${label}`);
}
async function visible(label){return nodes(await dump()).some(n=>matchesLabel(n,label));}
async function overlayFrame(){const windows=await adb('shell','dumpsys','window','windows');const block=windows.split(/(?=\n\s*Window #\d+)/).find(value=>value.includes(`package=${app} appop=SYSTEM_ALERT_WINDOW`)&&value.includes('mViewVisibility=0x0')&&value.includes('mHasSurface=true'));const frame=/(?:\bframe|\bmFrame)=\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(block??'')?.slice(1).map(Number);return frame&&frame[2]>frame[0]&&frame[3]>frame[1]?frame:null;}
async function screenshot(name){const {stdout}=await exec(adbPath,['-s',serial,'exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:20*1024*1024});await writeFile(path.join(output,`${name}.png`),stdout);}
async function pull(session){const response=await fetch(`${apiOrigin}/api/sync/pull`,{headers:{Authorization:`Bearer ${session.token}`}});assert.equal(response.status,200);return response.json();}
let apiLevel;
const results=[];const record=name=>{results.push({name,passed:true});writeFileSync(path.join(output,'results.json'),JSON.stringify({serial,apiLevel,results},null,2));console.log(`PASS ${name}`);};
await writeFile(path.join(output,'results.json'),JSON.stringify({serial,passed:false,startedAt:new Date().toISOString(),results},null,2));
try{
  assert.equal(await adb('shell','getprop','sys.boot_completed'),'1');
  apiLevel=Number(await adb('shell','getprop','ro.build.version.sdk'));
  if(apiLevel<=33)await prepareLegacyDump(adbPath,serial);
  await new Promise(resolve=>proxy.listen(4100,'0.0.0.0',resolve));
  if(!process.env.DAYFLOW_E2E_EXTERNAL_STACK)start('stack',['e2e/stack.mjs'],path.join(workspace,'frontend'),{DAYFLOW_E2E_API_PORT:String(apiPort),DAYFLOW_E2E_API_ONLY:'1'});
  await wait(async()=>{try{return (await fetch(`${apiOrigin}/api/health`,{signal:AbortSignal.timeout(2000)})).ok;}catch{return false;}},'Test API',120000);
  start('metro',['node_modules/expo/bin/cli','start','--lan','--port','8081'],root,{EXPO_PUBLIC_API_ORIGIN:'http://10.0.2.2:4100',NODE_ENV:'development',CI:'1'});
  await wait(async()=>{try{return (await fetch('http://127.0.0.1:8081/status')).ok;}catch{return false;}},'Metro',120000);
  // New AOSP "emu64x" fingerprints are not recognized as emulators by RN's
  // host detection. Route localhost explicitly for fresh test profiles too.
  await adb('reverse','tcp:8081','tcp:8081');
  await adb('install','-r',path.join(root,'android','app','build','outputs','apk','debug','app-debug.apk'));
  await adb('shell','am','force-stop',app);await adb('shell','pm','clear',app);
  const unique=`android_${Date.now()}`;
  const auth=await fetch(`${apiOrigin}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:`e2e-credential:${unique}:${unique}@e2e.test`})});assert.equal(auth.status,200);const session=await auth.json();
  await fixture('SESSION',session);
  await adb('shell','am','start','-n',`${app}/.MainActivity`);
  await wait(()=>visible('Today’s tasks'),'Android app startup',120000);record('authenticated native startup');
  await tap('History');await wait(()=>visible('Choose a day. Copy a task to Today to start it again.'),'Initial History navigation');await tap('Today');await wait(()=>visible('Today’s tasks'),'Initial Today navigation');record('tab navigation works before editing');
  let task;
  if(!process.env.DAYFLOW_E2E_INTEGRATIONS_ONLY){
  const taskTitle=`AndroidTask${Date.now()}`;
  await tap('＋ Add task');await wait(()=>visible('Title'),'Task editor');await tap('Title');await adb('shell','input','text',taskTitle);await adb('shell','input','keyevent','BACK');await tap('Save',{scroll:true});
  task=await wait(async()=> (await pull(session)).tasks.find(t=>t.title===taskTitle),'Android task reaches web');record('native task save and server sync');
  await wait(()=>visible('Today’s tasks'),'Task editor closes');
  const webDoc={...task,descriptionHtml:'<h2>From the website</h2><p><strong>Formatting retained</strong> and <a href="https://example.com">link</a></p>',updatedAt:new Date(Math.max(Date.now(),Date.parse(task.updatedAt)+1)).toISOString()};
  const pushed=await fetch(`${apiOrigin}/api/sync/push`,{method:'POST',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({changes:[{entity:'task',op:'upsert',doc:webDoc}]})});assert.equal(pushed.status,200);
  await wait(async()=> (await state()).tasks?.some(t=>t.id===task.id&&t.descriptionHtml.includes('Formatting retained')),'Website edit reaches phone');record('server changes reach native storage');
  await tap('Edit');await wait(()=>visible('Title'),'Reopen editor');await tap('Save',{scroll:true});
  await wait(async()=>{const row=(await pull(session)).tasks.find(t=>t.id===task.id);return Date.parse(row?.updatedAt)>Date.parse(webDoc.updatedAt)&&row.descriptionHtml.includes('<h2>')&&row.descriptionHtml.includes('<strong>');},'Rich text round trip');
  await wait(()=>visible('Today’s tasks'),'Edited task closes');record('rich text preserves HTML across mobile save');
  await adb('shell','am','start','-n',`${app}/com.dayflow.nativecore.ShareActivity`,'-a','android.intent.action.SEND','-t','text/plain','--es','android.intent.extra.TEXT','https://example.com/dayflow');
  await wait(()=>visible('New note'),'Incoming share');await tap('New note');await wait(()=>visible('Title'),'Shared note editor');await tap('Save',{scroll:true});
  await wait(async()=> (await pull(session)).notes.some(n=>n.descriptionHtml.includes('https://example.com/dayflow')),'Shared note sync');record('incoming link share uses normal note pipeline');
  await wait(()=>visible('Today’s tasks'),'Shared note editor closes');
  const yesterday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-86400000));
  await fixture('MUTATE',{entity:'task',doc:{title:'HistoryCopySource',taskDate:yesterday,status:'completed',reminderAt:new Date(Date.now()+86400000).toISOString(),estimatedMinutes:25}});
  const historySource=(await state()).tasks.find(value=>value.title==='HistoryCopySource');
  await tap('History');await wait(()=>visible('Copy to Today'),'History task');await tap('Copy to Today');await wait(()=>visible('OK'),'Copy confirmation');await tap('OK');
  const copied=await wait(async()=> (await pull(session)).tasks.find(value=>value.copiedFromTaskId===historySource.id),'History copy sync');
  assert.equal(copied.reminderAt,null);assert.equal(copied.status,'notStarted');assert.equal(copied.estimatedMinutes,25);assert.notEqual(copied.taskDate,yesterday);
  await tap('Today');await wait(()=>visible('Today’s tasks'),'Return from history');record('history copy keeps content and estimate without an old reminder');
  }else{
    await fixture('MUTATE',{entity:'task',doc:{title:'IntegrationSourceTask'}});
    task=(await state()).tasks.find(value=>value.title==='IntegrationSourceTask');
    await wait(async()=> (await pull(session)).tasks.some(value=>value.id===task.id),'Integration fixture sync');
  }
  await adb('shell','appops','set',app,'SYSTEM_ALERT_WINDOW','allow');if(apiLevel>=33)await adb('shell','pm','grant',app,'android.permission.POST_NOTIFICATIONS');
  if(!process.env.DAYFLOW_E2E_IMAGES_ONLY){
  await tap('Settings');await tap('Enable bubble',{scroll:true});await adb('shell','input','keyevent','HOME');await wait(async()=> (await state()).bubble,'Bubble service');
  for(let attempt=0;attempt<3;attempt++){
    const bubbleBounds=await wait(overlayFrame,'Floating bubble');
    console.log(`Overlay tap bounds: ${bubbleBounds.join(',')}`);
    await adb('shell','input','tap',String(Math.round((bubbleBounds[0]+bubbleBounds[2])/2)),String(Math.round((bubbleBounds[1]+bubbleBounds[3])/2)));
    if(await visible('Expand'))break;
  }
  await wait(()=>visible('Expand'),'Compact panel');await screenshot('bubble');
  await tap('Quick task title');await adb('shell','input','text','BubbleQuickTask');await adb('shell','input','keyevent','BACK');await tap('＋ Add task');
  await wait(async()=> (await pull(session)).tasks.some(value=>value.title==='BubbleQuickTask'),'Overlay sync');
  await tap('Expand');await wait(()=>visible('Today’s tasks'),'Bubble expansion');record('overlay panel creates a task, syncs and expands');
  await tap('Settings');await tap('Stop bubble',{scroll:true});await wait(async()=>!(await state()).bubble,'Stop bubble');
  await tap('Add home-screen widget',{scroll:true});
  const widgetAdd=await wait(async()=>{for(const label of ['Add to home screen','Add to Home screen','Add automatically','Add'])if(await visible(label))return label;},'Widget confirmation');
  await tap(widgetAdd);await wait(async()=> (await state()).widgetCount>0,'Widget binding');
  await adb('shell','input','keyevent','HOME');
  for(let page=0;page<3&&!await visible('Dayflow · Today');page++)await adb('shell','input','swipe','900','1200','100','1200','250');
  await wait(()=>visible('Dayflow · Today'),'Rendered home widget');await screenshot('widget');
  await tap('Complete task');await wait(async()=> (await state()).tasks.find(value=>value.id===task.id)?.status==='completed','Widget completion');
  assert((await state()).pending>0);
  await adb('shell','am','start','-n',`${app}/.MainActivity`);await wait(async()=> (await pull(session)).tasks.find(t=>t.id===task.id)?.status==='completed','Widget action sync');record('home-screen widget renders and completion queues then syncs');
  online=false;for(const socket of sockets)socket.destroy();
  await adb('shell','am','start','-n',`${app}/.MainActivity`,'-a','android.intent.action.VIEW','-d','dayflow:///editor?entity=task');await wait(()=>visible('Title'),'Offline editor');await tap('Title');await adb('shell','input','text','SurvivesOfflineRestart');await adb('shell','input','keyevent','BACK');await tap('Save',{scroll:true});
  await wait(async()=> (await state()).pending>0,'Offline outbox');await adb('shell','am','force-stop',app);await adb('shell','am','start','-n',`${app}/.MainActivity`);await wait(()=>visible('SurvivesOfflineRestart'),'Offline restart');online=true;
  await wait(async()=> (await pull(session)).tasks.some(t=>t.title==='SurvivesOfflineRestart'),'Reconnection upload',60000);record('offline task survives process restart and reconnects');
  }
  if(process.env.DAYFLOW_E2E_EXTENDED){
    online=false;for(const socket of sockets)socket.destroy();
    await fixture('SHARE_IMAGE',{base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='});
    await wait(()=>visible('New task'),'Image share preview');await screenshot('share-image');await tap('New task');await wait(()=>visible('Title'),'Image task editor');await tap('Save',{scroll:true});
    await wait(()=>visible('Today’s tasks'),'Image editor closes');
    const imageTask=await wait(async()=> (await state()).tasks.find(value=>value.title==='OfflineSharedImage'&&value.descriptionHtml.includes('data-local-id')),'Durable pending image');
    await adb('shell','am','force-stop',app);await adb('shell','am','start','-n',`${app}/.MainActivity`);await wait(()=>visible('Today’s tasks'),'Image offline restart');
    assert((await state()).tasks.find(value=>value.id===imageTask.id).descriptionHtml.includes('data-local-id'));
    online=true;
    const uploadedTask=await wait(async()=> (await pull(session)).tasks.find(value=>value.id===imageTask.id&&value.descriptionHtml.includes('/uploads/')&&!value.descriptionHtml.includes('data-local-id')),'Restarted image upload',60000);
    const imageUrl=/src="([^"]+)"/.exec(uploadedTask.descriptionHtml)?.[1];assert(imageUrl);
    const download=await fetch(`${apiOrigin}${imageUrl}`,{headers:{Authorization:`Bearer ${session.token}`}});assert.equal(download.status,200);record('shared image survives offline restart and uploads privately');
    await adb('shell','appops','set',app,'SCHEDULE_EXACT_ALARM','allow');
    await fixture('MUTATE',{entity:'task',doc:{title:'TimedAndroidReminder',reminderAt:new Date(Date.now()+8000).toISOString()}});
    const reminderTask=(await state()).tasks.find(value=>value.title==='TimedAndroidReminder');
    await wait(async()=> (await state()).notifications>0,'Scheduled notification',60000);
    await fixture('REMINDER',{id:reminderTask.id,action:'snooze'});
    assert(Date.parse((await state()).tasks.find(value=>value.id===reminderTask.id).reminderAt)>Date.now()+590000);
    assert.equal((await state()).notifications,0);
    await fixture('REMINDER',{id:reminderTask.id,action:'complete'});assert.equal((await state()).tasks.find(value=>value.id===reminderTask.id).status,'completed');record('scheduled reminder delivers, snoozes and completes through native actions');
    await adb('shell','appops','set',app,'SYSTEM_ALERT_WINDOW','deny');
    await adb('shell','am','start','-n',`${app}/.MainActivity`);await wait(()=>visible('Today’s tasks'),'App usable without overlay permission');record('ordinary app works with overlay permission revoked');
    const otherAuth=await fetch(`${apiOrigin}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:`e2e-credential:${unique}_other:${unique}_other@e2e.test`})});assert.equal(otherAuth.status,200);const otherSession=await otherAuth.json();
    online=false;for(const socket of sockets)socket.destroy();await fixture('MUTATE',{entity:'task',doc:{title:'AccountIsolatedPending'}});
    await adb('shell','am','force-stop',app);await fixture('SESSION',otherSession);await adb('shell','am','start','-n',`${app}/.MainActivity`);await wait(async()=> (await state()).account===otherSession.user.id,'Second account activation');await wait(()=>visible('Today’s tasks'),'Second account startup');assert.equal((await state()).tasks.length,0);
    await adb('shell','am','force-stop',app);await fixture('SESSION',session);await adb('shell','am','start','-n',`${app}/.MainActivity`);await wait(async()=> (await state()).account===session.user.id,'Original account activation');await wait(()=>visible('Today’s tasks'),'Original account restored');assert((await state()).tasks.some(value=>value.title==='AccountIsolatedPending'));online=true;
    await wait(async()=> (await pull(session)).tasks.some(value=>value.title==='AccountIsolatedPending'),'Original account pending write sync',60000);record('account databases and pending edits remain isolated across restarts');
    await tap('Settings');await tap('Sign out');await wait(()=>visible('Cancel'),'Sign-out confirmation');await tap('Sign out');await wait(async()=> !(await state()).account,'Signed-out native state');await wait(()=>visible('Continue with Google'),'Sign-in screen');record('sign out clears active account and native surfaces');
  }
  await screenshot('today');
  await writeFile(path.join(output,'results.json'),JSON.stringify({serial,apiLevel,android:await adb('shell','getprop','ro.build.version.release'),passed:true,results},null,2));
}catch(error){await screenshot('failure').catch(()=>{});await writeFile(path.join(output,'failure.txt'),String(error));const log=await adb('logcat','-d','-s','AndroidRuntime:E','ReactNativeJS:E').catch(()=> '');await writeFile(path.join(output,'runtime-errors.log'),log);throw error;}
finally{
  if(apiLevel<=33)await adb('shell','rm','-f','/data/local/tmp/dayflow-dump.jar').catch(()=>{});
  await adb('reverse','--remove','tcp:8081').catch(()=>{});
  for(const child of children) {
    if(process.platform==='win32' && child.pid)await exec('taskkill',['/PID',String(child.pid),'/T','/F']).catch(()=>{});
    else child.kill();
  }
  for(const socket of sockets)socket.destroy();proxy.close();
}
