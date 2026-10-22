const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([expoConfig, { ignores: ['android/**', '.gradle-user/**', '.signing/**', '.expo/**', 'test-results/**', 'dist/**', 'release/**', 'modules/**/android/**', 'src/generated/**'] }]);
