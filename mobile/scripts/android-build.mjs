import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, createWriteStream, statfsSync } from 'node:fs';
import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApk } from './verify-apk.mjs';
const actualRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const disk=statfsSync(actualRoot),freeGiB=disk.bavail*disk.bsize/1073741824;
if(freeGiB<20)throw new Error(`Android builds need at least 20 GiB free before starting; available: ${freeGiB.toFixed(1)} GiB. Remove completed test emulators or generated build caches first.`);
let root=actualRoot;
// CMake/Ninja emits absolute source paths into object paths. Use a reversible
// drive alias for this repository rather than moving it or changing system settings.
if(process.platform==='win32' && actualRoot.length>55) {
  const workspace=path.dirname(actualRoot);
  const mappings=execFileSync('subst.exe',[],{encoding:'utf8'});
  const existing=[...mappings.matchAll(/^([A-Z]):\\: => (.+)$/gm)].find(match=>path.normalize(match[2].trim()).toLowerCase()===workspace.toLowerCase());
  let drive=existing ? `${existing[1]}:` : null;
  if(!drive) for(const letter of ['J','K','L','M','N','O','P'])if(!existsSync(`${letter}:\\`)) {
    drive=`${letter}:`;execFileSync('subst.exe',[drive,workspace]);
    const owned=drive;process.on('exit',()=>{try{execFileSync('subst.exe',[owned,'/d']);}catch{}});break;
  }
  if(!drive)throw new Error('No free short drive alias. Set up a short workspace path for Android CMake.');
  root=path.join(drive+'\\',path.basename(actualRoot));
}
process.chdir(root);
const mode=process.argv[2] ?? 'release';
if(!['release','release-emulator','emulator','native-test'].includes(mode))throw new Error('Unknown Android build mode');
const releaseMode=mode==='release'||mode==='release-emulator';
const incremental=process.argv.includes('--incremental');
if(releaseMode&&incremental)throw new Error('Incremental prebuild is for development only; release generation must be clean.');
const abi=mode==='release'?'arm64-v8a':'x86_64';
const jdk=process.env.DAYFLOW_JAVA_HOME ?? (existsSync(path.join(root,'..','.tools','jdk17','bin','java.exe')) ? path.join(root,'..','.tools','jdk17') : 'C:\\Program Files\\Android\\Android Studio\\jbr');
const env={...process.env, JAVA_HOME:jdk, ANDROID_HOME:process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA,'Android','Sdk'), GRADLE_USER_HOME:path.join(root,'.gradle-user'), NODE_ENV:'production'};
if(root!==actualRoot){env.DAYFLOW_WORKSPACE_REAL=path.dirname(actualRoot);env.DAYFLOW_WORKSPACE_ALIAS=path.dirname(root).replace(/[\\/]$/, '');}
const ninja=path.join(root,'..','.tools','ninja','ninja.exe');if(existsSync(ninja))env.DAYFLOW_NINJA=ninja.replaceAll('\\','/');
delete env.ELECTRON_RUN_AS_NODE;
async function run(command,args,cwd=root,logName) {
  if(!logName){await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${path.basename(command)} failed (${code})`)));});return;}
  await mkdir(path.join(root,'test-results'),{recursive:true});
  const log=createWriteStream(path.join(root,'test-results',logName));let tail='';
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);tail=(tail+chunk.toString()).slice(-14000);});
    child.once('error',error=>{log.end();reject(error);});
    child.once('close',code=>{log.end(()=>{if(code!==0){process.stderr.write(tail);reject(new Error(`${path.basename(command)} failed (${code}); see test-results/${logName}`));}else{console.log(`Android ${mode} build succeeded; log: test-results/${logName}`);resolve();}});});
  });
}
if(process.platform==='win32' && !existsSync(ninja)){await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','bootstrap-ninja.ps1')]);env.DAYFLOW_NINJA=ninja.replaceAll('\\','/');}
await run(process.execPath,['scripts/build-editor.mjs']);
const configHash=createHash('sha256');for(const name of ['app.config.ts','plugins/withDayflow.cjs','package-lock.json'])configHash.update(await readFile(name));
const configRevision=configHash.digest('hex');const stamp=path.join(root,'.expo','dayflow-prebuild.txt');
const savedRevision=existsSync(stamp)?await readFile(stamp,'utf8'):null;
if(!existsSync(path.join(root,'android','gradlew.bat')) || (savedRevision!==configRevision && (releaseMode||savedRevision!==configRevision+':incremental'))) {
  const prebuild=['node_modules/expo/bin/cli','prebuild','--platform','android','--no-install'];
  if(incremental)prebuild.push('--no-clean');
  await run(process.execPath,prebuild);
  await mkdir(path.dirname(stamp),{recursive:true});await writeFile(stamp,configRevision+(incremental?':incremental':''));
}
if(releaseMode) {
  const directory=path.join(root,'.signing');await mkdir(directory,{recursive:true});
  const credentialsFile=path.join(directory,'credentials.json');let credentials;
  if(existsSync(credentialsFile))credentials=JSON.parse(await readFile(credentialsFile,'utf8'));
  else { credentials={password:randomBytes(32).toString('base64url')};await writeFile(credentialsFile,JSON.stringify(credentials),{mode:0o600}); }
  env.DAYFLOW_KEYSTORE=path.join(directory,'dayflow-release.jks');env.DAYFLOW_STORE_PASSWORD=credentials.password;
  if(!existsSync(env.DAYFLOW_KEYSTORE))await run(path.join(jdk,'bin','keytool.exe'),['-genkeypair','-keystore',env.DAYFLOW_KEYSTORE,'-alias','dayflow','-keyalg','RSA','-keysize','3072','-validity','10000','-storepass:env','DAYFLOW_STORE_PASSWORD','-keypass:env','DAYFLOW_STORE_PASSWORD','-dname','CN=Dayflow Private Release']);
}
const gradle=path.join(root,'android','gradlew.bat');
const tasks=releaseMode?['assembleRelease']:mode==='native-test'?[':dayflow-native:testDebugUnitTest']:['assembleDebug',':dayflow-native:testDebugUnitTest'];
const args=[...tasks,'-PreactNativeArchitectures='+abi,'-Dorg.gradle.java.installations.paths='+jdk,'-Pkotlin.compiler.execution.strategy=in-process','--no-daemon','--console=plain','--max-workers=2'];
await run(path.join(jdk,'bin','java.exe'),['-Dorg.gradle.appname=gradlew','-classpath',path.join(root,'android','gradle','wrapper','gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain',...args],path.dirname(gradle),`build-${mode}.log`);
if(releaseMode) {
  const artifact=path.join(root,'android','app','build','outputs','apk','release','app-release.apk');
  const publicCertificate=execFileSync(path.join(jdk,'bin','keytool.exe'),['-exportcert','-keystore',env.DAYFLOW_KEYSTORE,'-alias','dayflow','-storepass:env','DAYFLOW_STORE_PASSWORD'],{env,stdio:['ignore','pipe','pipe']});
  const verification=verifyApk(artifact,{sdk:env.ANDROID_HOME,jdk,abi,expectedCertificateSha256:createHash('sha256').update(publicCertificate).digest('hex')});
  const output=path.join(root,'release');await mkdir(output,{recursive:true});
  const version=JSON.parse(await readFile('package.json','utf8')).version;
  const name=`Dayflow-${version}-${mode==='release'?'arm64':'emulator-x86_64'}.apk`;await copyFile(artifact,path.join(output,name));
  const bytes=(await stat(artifact)).size;const sha256=createHash('sha256').update(await readFile(artifact)).digest('hex');
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const sourceDirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
  await writeFile(path.join(output,mode==='release'?'SHA256SUMS.txt':'SHA256SUMS-emulator.txt'),`${sha256}  ${name}\n`);
  await writeFile(path.join(output,mode==='release'?'release.json':'release-emulator.json'),JSON.stringify({version,filename:name,bytes,sha256,sourceCommit,sourceDirty,...verification,sizeTargetBytes:40000000,sizeReviewRequired:bytes>40000000},null,2)+'\n');
  console.log(`Signed APK: release/${name}\nSize: ${(bytes/1000000).toFixed(2)} MB\nSHA256: ${sha256}`);
  if(bytes>40000000)console.warn('Size target exceeded: document review before distribution.');
}
