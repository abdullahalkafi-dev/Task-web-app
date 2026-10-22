import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, statfsSync, realpathSync, rmSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const api=Number(process.argv[2]??36),stop=process.argv.includes('--stop');
const discard=process.argv.includes('--discard');
if(discard&&!stop)throw new Error('--discard requires --stop and removes only this dedicated test emulator');
const memory=api===36?3072:2048;
if(![31,32,33,34,35,36].includes(api))throw new Error('Choose an Android API from 31 through 36');
const sdk=process.env.ANDROID_HOME??path.join(process.env.LOCALAPPDATA,'Android','Sdk');
const avdHome=path.join(workspace,'.tools','avd'),name=`DayflowApi${api}`,serial=`emulator-${5556+2*(36-api)}`;
const adb=path.join(sdk,'platform-tools','adb.exe');
const env={...process.env,ANDROID_AVD_HOME:avdHome};
const run=(file,args,input)=>execFileSync(file,args,{env,encoding:'utf8',input,stdio:['pipe','pipe','pipe']});
const devices=run(adb,['devices']);
const running=devices.includes(`${serial}\t`);
if(running && run(adb,['-s',serial,'emu','avd','name']).split(/[\r\n]+/)[0].trim()!==name)throw new Error(`${serial} belongs to another emulator`);
if(stop){
  if(running){console.log(run(adb,['-s',serial,'emu','kill']));const end=Date.now()+30000;while(run(adb,['devices']).includes(`${serial}\t`)&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,500));if(run(adb,['devices']).includes(`${serial}\t`))throw new Error('Emulator has not stopped; refusing to discard its files');}
  if(discard && existsSync(avdHome)){
    const base=realpathSync(avdHome),allowed=path.join(realpathSync(workspace),'.tools','avd');
    if(base.toLowerCase()!==allowed.toLowerCase())throw new Error('Test emulator directory is outside the expected workspace path');
    for(const suffix of ['.avd','.ini']){const target=path.resolve(base,name+suffix);if(path.dirname(target)!==base)throw new Error('Invalid emulator cleanup path');if(existsSync(target)){if(lstatSync(target).isSymbolicLink())throw new Error('Refusing linked emulator cleanup target');rmSync(target,{recursive:true,force:true,maxRetries:20,retryDelay:250});}}
    console.log(`Discarded ${name} test data; test reports and signing keys are retained.`);
  }
  process.exit(0);
}
for(const other of devices.matchAll(/^(emulator-\d+)\tdevice\r?$/gm)){if(other[1]===serial)continue;const otherName=run(adb,['-s',other[1],'emu','avd','name']).split(/[\r\n]+/)[0].trim();if(/^DayflowApi(?:31|32|33|34|35|36)$/.test(otherName))throw new Error(`Stop ${otherName} first; run only one Dayflow test emulator at a time`);}
if(!running){const disk=statfsSync(workspace),freeGiB=disk.bavail*disk.bsize/1073741824;if(freeGiB<15)throw new Error(`Test emulators need at least 15 GiB free before starting; available: ${freeGiB.toFixed(1)} GiB. Discard completed test profiles first.`);}
mkdirSync(avdHome,{recursive:true});
if(!running){
  const image=`system-images;android-${api};${api===36?'google_apis':'default'};x86_64`;
  const imagePath=path.join(sdk,...image.split(';'));
  if(!existsSync(path.join(imagePath,'source.properties')))throw new Error(`Install ${image} with Android SDK Manager first`);
  if(!existsSync(path.join(avdHome,`${name}.ini`))) {
    const java=path.join(process.env.DAYFLOW_JAVA_HOME??path.join(workspace,'.tools','jdk17'),'bin','java.exe');
    const tools=path.join(sdk,'cmdline-tools','latest');
    run(java,['-Dcom.android.sdkmanager.toolsdir='+tools,'-classpath',path.join(tools,'lib','avdmanager-classpath.jar'),'com.android.sdklib.tool.AvdManagerCli','create','avd','--name',name,'--package',image,'--device','pixel_6'],'no\n');
    const config=path.join(avdHome,`${name}.avd`,'config.ini');
    writeFileSync(config,readFileSync(config,'utf8').replace(/disk.dataPartition.size=.*/,'disk.dataPartition.size=2G').replace(/hw.ramSize=.*/,`hw.ramSize=${memory}M`));
  }
  const stdout=openSync(path.join(avdHome,`api${api}.stdout.log`),'w'),stderr=openSync(path.join(avdHome,`api${api}.stderr.log`),'w');
  const child=spawn(path.join(sdk,'emulator','emulator.exe'),['-avd',name,'-port',serial.split('-')[1],'-no-window','-no-audio','-no-snapshot','-no-boot-anim','-gpu','swiftshader_indirect','-memory',String(memory),'-cores','4'],{env,detached:true,windowsHide:true,stdio:['ignore',stdout,stderr]});
  child.unref();closeSync(stdout);closeSync(stderr);
}
const deadline=Date.now()+180000;
while(Date.now()<deadline){
  try{if(run(adb,['-s',serial,'shell','getprop','sys.boot_completed']).trim()==='1'){console.log(`${name} ready: ${serial}`);process.exit(0);}}catch{/* booting */}
  await new Promise(resolve=>setTimeout(resolve,2000));
}
throw new Error(`${name} did not boot; inspect .tools/avd/api${api}.stderr.log`);
