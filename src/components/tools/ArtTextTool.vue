<script setup>
import { ref, watch } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import { TextCaseTitle24Regular } from '@vicons/fluent'
import { useToolStorage } from '../../composables/useToolStorage.js'
import ToolActionBar from './ui/ToolActionBar.vue'
import ToolCard from './ui/ToolCard.vue'
import ToolField from './ui/ToolField.vue'
import ToolPageHeader from './ui/ToolPageHeader.vue'
import ToolTextarea from './ui/ToolTextarea.vue'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()

// ===== 字形表 =====
const DIGITS = '0123456789'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALNUM = DIGITS + LOWER + UPPER

// 目标串必须与源串严格同位对齐：某位没有字形就写 NO_GLYPH 占位，该位原样输出。
// 不能用「少写一个字符」表达缺失 —— 那会让后面每一位静默前移一格，人眼在 62 位的
// Unicode 串上根本数不出来（上角标表历史上就这么错过一次，q 之后全体错位）。
const NO_GLYPH = '-'

// 借位规则：Unicode 没有该位的下标字形时借同音希腊下标（β→b、γ→g、φ→f），连希腊字母也没有的
// （c d q）留空位原样输出。w/y/z 用的是 Unicode 18.0 新增的真下标，字体还没跟上时可能显示为空。
const SUB_ROW = 'ₐᵦ--ₑᵩᵧₕᵢⱼₖₗₘₙₒₚ-ᵣₛₜᵤᵥ₝ₓ₞₟'
const SUP_ROW = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖ-ʳˢᵗᵘᵛʷˣʸᶻ'
// 上角标大写：专供的大写修饰字母只有 A B D E G H I J K L M N O P R T U V W，
// 其余借同位的小写上角标（ᶜ ᶠ ˢ ˣ ʸ ᶻ），Q 两套都没有
const SUP_UPPER_ROW = 'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾ-ᴿˢᵀᵁⱽᵂˣʸᶻ'

// 全角区偏移：ASCII 的数字与字母加 0xFEE0 即对应全角字形
const FULLWIDTH_OFFSET = 0xFEE0
const toFullwidth = (chars) =>
  [...chars].map((c) => String.fromCharCode(c.charCodeAt(0) + FULLWIDTH_OFFSET)).join('')

const MODES = [
  { label: '衬线体', value: 'fullwidth', source: ALNUM, target: toFullwidth(ALNUM) },
  { label: '上角标 - 仅部分', value: 'superscript', source: ALNUM, target: '⁰¹²³⁴⁵⁶⁷⁸⁹' + SUP_ROW + SUP_UPPER_ROW },
  // 下标没有任何大写专供字形，大写行直接复用小写行，同一字母的大小写输出一致
  { label: '下角标 - 仅部分', value: 'subscript', source: ALNUM, target: '₀₁₂₃₄₅₆₇₈₉' + SUB_ROW + SUB_ROW },
  { label: '类拉丁文 - 仅大写', value: 'latin', source: UPPER, target: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ' },
]

// 按码点对齐建表，避免目标串混入星面字符时整表错位；占位位不写表，转换时原样输出
const MODE_TABLES = new Map(
  MODES.map(({ value, source, target }) => {
    const glyphs = [...target]
    const table = []
    for (let i = 0; i < source.length; i++) {
      if (glyphs[i] && glyphs[i] !== NO_GLYPH) table[source.charCodeAt(i)] = glyphs[i]
    }
    return [value, table]
  }),
)

if (import.meta.env.DEV) {
  for (const { value, source, target } of MODES) {
    const size = [...target].length
    if (size !== source.length) {
      console.warn(`[艺术字] ${value} 的目标表 ${size} 位与源表 ${source.length} 位不等长，映射已错位`)
    }
  }
}

const modeOptions = MODES.map(({ label, value }) => ({ label, value }))

const inputText = ref('')
const outputText = ref('')
const selectedMode = ref('fullwidth')

useToolStorage('lonzovtool-arttext', { inputText, selectedMode }, {
  onRestored: () => {
    if (inputText.value.trim()) outputText.value = transformText(inputText.value, selectedMode.value)
  },
})

// 模式换掉后旧结果就不再对应，直接按新模式重算，避免结果框里留着上一个模式的产物
watch(selectedMode, (mode) => {
  if (outputText.value) outputText.value = transformText(inputText.value, mode)
})

/** 逐码点查表；代理对与表外字符都取不到值，按原字符输出 */
function transformText(text, mode) {
  const table = MODE_TABLES.get(mode)
  if (!table) return text

  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += table[text.charCodeAt(i)] ?? text[i]
  }
  return result
}

function handleConvert() {
  if (!inputText.value.trim()) {
    message.warning('请输入需要转换的文本', { duration: 1800 })
    return
  }
  outputText.value = transformText(inputText.value, selectedMode.value)
  message.success('转换成功！', { duration: 1800 })
}

function handleClear() {
  inputText.value = ''
  outputText.value = ''
}
</script>

<template>
  <div class="arttext-tool">
    <ToolPageHeader
      :icon="TextCaseTitle24Regular"
      title="艺术字转换"
      desc="将字母数字转换为游戏内的艺术字"
    />

    <!-- 配置+输入卡片，底部收一条贯穿式操作栏 -->
    <ToolCard>
      <ToolField
        label="转换模式"
        help="【仅转换数字和字母】字母数字会被替换成对应字形，无法映射的字符原样保留"
      >
        <NSelect
          v-model:value="selectedMode"
          :options="modeOptions"
          class="field-select"
        />
      </ToolField>

      <ToolField label="输入文本" html-for="arttext-input">
        <ToolTextarea
          id="arttext-input"
          v-model="inputText"
          placeholder="在此输入需要转换的文本..."
        />
      </ToolField>

      <template #footer>
        <ToolActionBar
          :output="outputText"
          @convert="handleConvert"
          @clear="handleClear"
        />
      </template>
    </ToolCard>

    <!-- 输出区（单独卡片） -->
    <ToolCard>
      <ToolField
        label="转换结果"
        html-for="arttext-output"
        help="*此处可能不支持渲染，请以游戏内实际效果为准"
      >
        <ToolTextarea
          id="arttext-output"
          :model-value="outputText"
          placeholder="转换结果将显示在这里..."
          readonly
        />
      </ToolField>
    </ToolCard>
  </div>
</template>

<style scoped>
.arttext-tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-select {
  width: 100%;
}

.field-select :deep(.n-base-selection) {
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease,
    box-shadow 0.4s ease;
}
</style>
