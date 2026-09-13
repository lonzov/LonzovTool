import { ref, computed } from 'vue'
import { parseTags } from '../utils/mcTranslate.js'

/**
 * T显编辑器 · 预览模拟器（模块级单例）
 *
 * 用于在预览里解析 with.rawtext 内的 selector / score 元素。
 * 数据量 < 1KB，且需要首帧就可用，所以走 localStorage 而非 localforage；
 * 也因此可以随设置页一起导出/导入/清空（见 SettingsView 的 CONFIG_SCOPES）。
 */

const STORAGE_KEY = 'lonzovtool-rawjson-jzfk-sim'

export const simPlayer = ref('Steve')
export const simMissing = ref('0')
export const simTagsText = ref('')
/** [{ player, objective, score }]，全部以字符串维护，便于输入框双向绑定 */
export const simScores = ref([])

export const showSimModal = ref(false)
export const simScoreConfirmIdx = ref(null)
let scoreConfirmTimer = null

/** 传给渲染内核的只读快照 */
export const simulator = computed(() => ({
  player: simPlayer.value.trim() || 'Steve',
  missing: simMissing.value === '' ? '0' : simMissing.value,
  tags: parseTags(simTagsText.value),
  scores: simScores.value
    .filter(s => s.player && s.objective)
    .map(s => ({ player: s.player.trim(), objective: s.objective.trim(), score: s.score })),
}))

/** 收起态/入口摘要用的一行描述 */
export const simulatorSummary = computed(() => {
  const sim = simulator.value
  return `${sim.player} · 缺失 ${sim.missing} · ${sim.scores.length} 条记分板`
})

// ========== 持久化 ==========

let saveTimer = null

export function loadSimFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    if (typeof d.player === 'string') simPlayer.value = d.player
    if (typeof d.missing === 'string') simMissing.value = d.missing
    if (typeof d.tags === 'string') simTagsText.value = d.tags
    if (Array.isArray(d.scores)) {
      simScores.value = d.scores.map(s => ({
        player: String(s?.player ?? ''),
        objective: String(s?.objective ?? ''),
        score: String(s?.score ?? ''),
      }))
    }
  } catch { /* ignore */ }
}

export function persistSimNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      player: simPlayer.value,
      missing: simMissing.value,
      tags: simTagsText.value,
      scores: simScores.value,
    }))
  } catch { /* ignore */ }
}

export function triggerSimSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persistSimNow, 300)
}

export function disposeSimulator() {
  persistSimNow()
  clearTimeout(saveTimer)
  clearScoreConfirm()
}

// ========== 记分板行操作 ==========

export function addSimScore() {
  simScores.value.push({ player: simPlayer.value.trim() || 'Steve', objective: '', score: '0' })
  triggerSimSave()
}

export function removeSimScore(idx) {
  if (simScoreConfirmIdx.value === idx) {
    clearScoreConfirm()
    simScores.value.splice(idx, 1)
    triggerSimSave()
    return
  }
  clearScoreConfirm()
  simScoreConfirmIdx.value = idx
  scoreConfirmTimer = setTimeout(() => { simScoreConfirmIdx.value = null }, 5000)
}

function clearScoreConfirm() {
  clearTimeout(scoreConfirmTimer)
  scoreConfirmTimer = null
  simScoreConfirmIdx.value = null
}

export function resetSimulator() {
  simPlayer.value = 'Steve'
  simMissing.value = '0'
  simTagsText.value = ''
  simScores.value = []
  triggerSimSave()
}

// ========== 弹窗 ==========

export function openSimModal() {
  clearScoreConfirm()
  showSimModal.value = true
}
export function closeSimModal() {
  showSimModal.value = false
  clearScoreConfirm()
  persistSimNow()
}
