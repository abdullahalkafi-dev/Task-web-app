const { withAppBuildGradle, withAndroidManifest, withSettingsGradle, withGradleProperties } = require('expo/config-plugins');
module.exports = config => {
  config = withGradleProperties(config, mod => {
    mod.modResults = mod.modResults.filter(value => value.key !== 'edgeToEdgeEnabled');
    mod.modResults.push({ type: 'property', key: 'edgeToEdgeEnabled', value: 'true' });
    return mod;
  });
  config = withSettingsGradle(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replace('ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)', 'ex.autolinkLibrariesFromCommand(["node", new File(rootDir, "../scripts/autolink.cjs").absolutePath, "--platform", "android"])');
    if (!mod.modResults.contents.includes('// Dayflow short Windows paths')) mod.modResults.contents += `
// Dayflow short Windows paths
def dayflowReal = System.getenv('DAYFLOW_WORKSPACE_REAL')
def dayflowAlias = System.getenv('DAYFLOW_WORKSPACE_ALIAS')
if (dayflowReal && dayflowAlias) {
  gradle.settingsEvaluated {
    rootProject.children.each { descriptor ->
      descriptor.projectDir = new File(descriptor.projectDir.absolutePath.replace(dayflowReal, dayflowAlias))
    }
  }
}
`;
    return mod;
  });
  config = withAndroidManifest(config, mod => {
    mod.modResults.manifest.application[0].$['android:allowBackup'] = 'false';
    return mod;
  });
  return withAppBuildGradle(config, mod => {
    let text=mod.modResults.contents;
    const marker='// Dayflow release identity';
    if(!text.includes(marker)) {
      text=text.replace('signingConfigs {',`signingConfigs {\n        ${marker}\n        dayflow {\n            if (System.getenv('DAYFLOW_KEYSTORE')) {\n                storeFile file(System.getenv('DAYFLOW_KEYSTORE'))\n                storePassword System.getenv('DAYFLOW_STORE_PASSWORD')\n                keyAlias 'dayflow'\n                keyPassword System.getenv('DAYFLOW_STORE_PASSWORD')\n            }\n        }`);
    }
    text=text.replace(/release\s*\{[\s\S]*?signingConfig signingConfigs.debug/, block => block.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.dayflow'));
    if(!text.includes('CMAKE_OBJECT_PATH_MAX')) text=text.replace('defaultConfig {', 'defaultConfig {\n        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=250"; if (System.getenv("DAYFLOW_NINJA")) { arguments "-DCMAKE_MAKE_PROGRAM=" + System.getenv("DAYFLOW_NINJA") } } }');
    mod.modResults.contents=text;return mod;
  });
};
