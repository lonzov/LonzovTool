import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/v2/**', '**/public/c/**', '**/docs/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,

  {
    name: 'app/node-scripts',
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },

  {
    name: 'app/node-cjs-scripts',
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },

  {
    name: 'app/rawjson-inline-editor',
    files: ['src/components/tools/RawJsonInlineEditor.vue'],
    rules: {
      // 就地编辑器有意直接写回父级传入的元素对象：没有保存步骤，每次输入都要立刻
      // 刷新预览与命令输出。只保留对整体替换 prop 的检查。
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
    },
  },
])
