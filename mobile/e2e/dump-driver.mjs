import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const workspace=path.resolve(here,'../..'),remote='/data/local/tmp/dayflow-dump.jar';
export async function prepareLegacyDump(adb,serial){
  const sdk=process.env.ANDROID_HOME??path.join(process.env.LOCALAPPDATA,'Android','Sdk');
  const jdk=process.env.DAYFLOW_JAVA_HOME??path.join(workspace,'.tools','jdk17');
  const source=path.join(here,'dump','DayflowDump.java'),output=path.resolve(here,'../test-results/dump-driver');
  const classes=path.join(output,'classes'),dex=path.join(output,'dex'),jar=path.join(output,'dayflow-dump.jar');
  const revision=createHash('sha256').update(await readFile(source)).digest('hex');
  const stamp=path.join(output,'revision.txt');
  if(!existsSync(jar)||!existsSync(stamp)||await readFile(stamp,'utf8')!==revision){
    await mkdir(classes,{recursive:true});await mkdir(dex,{recursive:true});
    const android=['android-37.0','android-37','android-36','android-31'].map(version=>path.join(sdk,'platforms',version,'android.jar')).find(file=>existsSync(file));
    if(!android)throw new Error('Install the project-compatible Android SDK platform first');
    await exec(path.join(jdk,'bin','javac.exe'),['-source','8','-target','8','-classpath',android,'-d',classes,source]);
    await exec(path.join(jdk,'bin','java.exe'),['-classpath',path.join(sdk,'build-tools','37.0.0','lib','d8.jar'),'com.android.tools.r8.D8','--min-api','31','--lib',android,'--output',dex,path.join(classes,'com','dayflow','testdriver','DayflowDump.class')]);
    await exec(path.join(jdk,'bin','jar.exe'),['--create','--file',jar,'-C',dex,'classes.dex']);
    await writeFile(stamp,revision);
  }
  await exec(adb,['-s',serial,'push',jar,remote]);
}
export async function legacyDump(adb,serial){
  const {stdout:png}=await exec(adb,['-s',serial,'exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:20*1024*1024,timeout:15000});
  if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Invalid display screenshot');
  const {stdout}=await exec(adb,['-s',serial,'shell',`CLASSPATH=${remote}:/system/framework/uiautomator.jar`,'app_process','/system/bin','com.dayflow.testdriver.DayflowDump','/sdcard/dayflow-window.xml',String(png.readUInt32BE(16)),String(png.readUInt32BE(20))],{timeout:15000,maxBuffer:1024*1024});
  return stdout.trim();
}
