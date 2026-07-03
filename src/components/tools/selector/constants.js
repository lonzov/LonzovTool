import { computed } from 'vue'

// ========== 选择器类型选项 ==========

export const SELECTOR_OPTIONS = [
  { label: '@a (所有玩家)', value: '@a' },
  { label: '@e (所有实体)', value: '@e' },
  { label: '@p (最近玩家)', value: '@p' },
  { label: '@r (随机玩家)', value: '@r' },
  { label: '@s (执行者)', value: '@s' },
]

// ========== 参数种类定义 ==========

export const PARAM_KINDS = {
  x: { label: 'x', category: '坐标', editor: 'text' },
  y: { label: 'y', category: '坐标', editor: 'text' },
  z: { label: 'z', category: '坐标', editor: 'text' },
  dx: { label: 'dx', category: '坐标', editor: 'text' },
  dy: { label: 'dy', category: '坐标', editor: 'text' },
  dz: { label: 'dz', category: '坐标', editor: 'text' },
  type: { label: 'type', category: '实体', editor: 'text-not' },
  name: { label: 'name', category: '实体', editor: 'name' },
  tag: { label: 'tag', category: '实体', editor: 'tag' },
  r: { label: 'r', category: '范围', editor: 'text' },
  rm: { label: 'rm', category: '范围', editor: 'text' },
  scores: { label: 'scores', category: '计分板', editor: 'scores' },
  C: { label: 'c', category: '选择', editor: 'text' },
  l: { label: 'l', category: '经验', editor: 'text' },
  lm: { label: 'lm', category: '经验', editor: 'text' },
  m: { label: 'm', category: '实体', editor: 'gamemode' },
  rx: { label: 'rx', category: '角度', editor: 'text' },
  ry: { label: 'ry', category: '角度', editor: 'text' },
  rxm: { label: 'rxm', category: '角度', editor: 'text' },
  rym: { label: 'rym', category: '角度', editor: 'text' },
  family: { label: 'family', category: '实体', editor: 'text' },
  hasitem: { label: 'hasitem', category: '物品', editor: 'hasitem' },
  haspermission: { label: 'haspermission', category: '权限', editor: 'haspermission' },
  has_property: { label: 'has_property', category: '属性', editor: 'has_property' },
  auto_calc: { label: '自动计算', category: '坐标', editor: 'auto_calc' },
}

// 参数种类分组（决定添加时下拉菜单的顺序）
export const PARAM_KIND_GROUPS = [
  { label: '坐标', keys: ['x', 'y', 'z', 'dx', 'dy', 'dz', 'auto_calc'] },
  { label: '范围', keys: ['r', 'rm', 'C'] },
  { label: '实体', keys: ['type', 'name', 'tag', 'm', 'family'] },
  { label: '实体属性', keys: ['rx', 'ry', 'rxm', 'rym', 'l', 'lm', 'haspermission', 'has_property'] },
  { label: '计分板', keys: ['scores'] },
  { label: '物品', keys: ['hasitem'] },
]

// 构建 NDropdown 用的选项（分类 → 参数，搜索栏风格）
export const kindDropdownOptions = computed(() => {
  const options = []
  for (const g of PARAM_KIND_GROUPS) {
    const children = g.keys
      .filter(k => PARAM_KINDS[k])
      .map(k => ({ label: PARAM_KINDS[k].label, key: k }))
    if (!children.length) continue
    options.push({
      label: g.label,
      key: 'group-' + g.label,
      children,
    })
  }
  options.push({ type: 'divider', key: 'divider-custom' })
  options.push({ label: '自定义', key: 'custom' })
  return options
})

// 游戏模式选项
export const GAMEMODE_OPTIONS = [
  { label: '默认', value: 'default' },
  { label: '生存', value: 'survival' },
  { label: '创造', value: 'creative' },
  { label: '冒险', value: 'adventure' },
  { label: '旁观', value: 'spectator' },
]

// 权限选项（用于级联选择等场景）
export const PERMISSION_OPTIONS = [
  {
    label: 'camera (视角转动)',
    value: 'camera',
    children: [
      { label: 'enabled (启用)', value: 'enabled' },
      { label: 'disabled (禁用)', value: 'disabled' },
    ],
  },
  {
    label: 'movement (位置移动)',
    value: 'movement',
    children: [
      { label: 'enabled (启用)', value: 'enabled' },
      { label: 'disabled (禁用)', value: 'disabled' },
    ],
  },
]

// haspermission 编辑页用的 enabled/disabled 选项
export const PERM_VALUE_OPTIONS = [
  { label: 'enabled', value: 'enabled' },
  { label: 'disabled', value: 'disabled' },
]
