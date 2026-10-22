import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

/** Verify the built artifact rather than assuming Gradle configuration was used. */
export function verifyApk(artifact,{sdk,jdk,abi,expectedCertificateSha256}) {
  const java=path.join(jdk,'bin',process.platform==='win32'?'java.exe':'java');
  const tools=path.join(sdk,'build-tools','37.0.0');
  const certificate=execFileSync(java,['-jar',path.join(tools,'lib','apksigner.jar'),'verify','--print-certs',artifact],{encoding:'utf8'});
  const certificateSha256=/certificate SHA-256 digest:\s*([a-f0-9]+)/i.exec(certificate)?.[1];
  assert(certificateSha256,'APK has no signing certificate fingerprint');
  if(expectedCertificateSha256)assert.equal(certificateSha256.toLowerCase(),expectedCertificateSha256.toLowerCase(),'APK was signed with a different key');
  execFileSync(path.join(tools,process.platform==='win32'?'zipalign.exe':'zipalign'),['-c','-P','16','4',artifact]);
  const analyzerArgs=['-Dcom.android.sdklib.toolsdir='+path.join(sdk,'cmdline-tools','latest'),'-classpath',path.join(sdk,'cmdline-tools','latest','lib','apkanalyzer-classpath.jar'),'com.android.tools.apk.analyzer.ApkAnalyzerCli'];
  const analyze=(args,encoding='utf8')=>execFileSync(java,[...analyzerArgs,...args,artifact],{encoding,maxBuffer:100*1024*1024});
  const manifest=analyze(['manifest','print']);
  assert.match(manifest,/package="com\.dayflow\.mobile"/);
  assert.match(manifest,/android:minSdkVersion="31"/);assert.match(manifest,/android:targetSdkVersion="36"/);
  assert.doesNotMatch(manifest,/android:debuggable="true"|TestReceiver/);
  assert.doesNotMatch(manifest,/android\.permission\.(CAMERA|RECORD_AUDIO|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE)"/);
  const files=analyze(['files','list']).split(/\r?\n/).map(line=>line.trim());
  const libraries=files.filter(file=>/^\/lib\/[^/]+\/[^/]+\.so$/.test(file));
  assert(libraries.length>0,'No native libraries found');
  assert.deepEqual([...new Set(libraries.map(file=>file.split('/')[2]))],[abi]);
  assert(!files.some(file=>file.endsWith('.map')),'Source maps must not be packaged');
  for(const file of libraries) {
    const elf=analyze(['files','cat','--file',file],null);
    assert.equal(elf.subarray(0,4).toString('hex'),'7f454c46');assert.equal(elf[4],2);assert.equal(elf[5],1);
    const offset=Number(elf.readBigUInt64LE(32)),length=elf.readUInt16LE(54),count=elf.readUInt16LE(56);
    for(let index=0;index<count;index++) {
      const header=offset+index*length;
      if(elf.readUInt32LE(header)===1)assert(elf.readBigUInt64LE(header+48)>=16384n,`${file} is not aligned for 16 KB pages`);
    }
  }
  return {applicationId:'com.dayflow.mobile',minSdk:31,targetSdk:36,compileSdk:37,abi,signatureVerified:true,zipAlignment16KB:true,elfAlignment16KB:true,nativeLibraries:libraries.length,certificateSha1:/certificate SHA-1 digest:\s*([a-f0-9]+)/i.exec(certificate)?.[1],certificateSha256};
}
