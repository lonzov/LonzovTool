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
  x: { label: 'x', category: '坐标', editor: 'text', desc: 'X轴坐标' },
  y: { label: 'y', category: '坐标', editor: 'text', desc: 'Y轴坐标' },
  z: { label: 'z', category: '坐标', editor: 'text', desc: 'Z轴坐标' },
  dx: { label: 'dx', category: '坐标', editor: 'text', desc: 'X轴偏移量' },
  dy: { label: 'dy', category: '坐标', editor: 'text', desc: 'Y轴偏移量' },
  dz: { label: 'dz', category: '坐标', editor: 'text', desc: 'Z轴偏移量' },
  type: { label: 'type', category: '实体', editor: 'text-not', desc: '实体类型，可反选' },
  name: { label: 'name', category: '实体', editor: 'name', desc: '实体名称，可反选' },
  tag: { label: 'tag', category: '实体', editor: 'tag', desc: '标签，可反选' },
  r: { label: 'r', category: '范围', editor: 'text', desc: '最大半径' },
  rm: { label: 'rm', category: '范围', editor: 'text', desc: '最小半径' },
  scores: { label: 'scores', category: '计分板', editor: 'scores', desc: '计分板分数筛选' },
  C: { label: 'c', category: '选择', editor: 'text', desc: '选择数量/顺序' },
  l: { label: 'l', category: '经验', editor: 'text', desc: '最大经验等级' },
  lm: { label: 'lm', category: '经验', editor: 'text', desc: '最小经验等级' },
  m: { label: 'm', category: '实体', editor: 'gamemode', desc: '游戏模式，可反选' },
  rx: { label: 'rx', category: '角度', editor: 'text', desc: '最大垂直旋转角度' },
  ry: { label: 'ry', category: '角度', editor: 'text', desc: '最大水平旋转角度' },
  rxm: { label: 'rxm', category: '角度', editor: 'text', desc: '最小垂直旋转角度' },
  rym: { label: 'rym', category: '角度', editor: 'text', desc: '最小水平旋转角度' },
  family: { label: 'family', category: '实体', editor: 'text', desc: '实体族，可反选' },
  hasitem: { label: 'hasitem', category: '物品', editor: 'hasitem', desc: '持有物品检测' },
  haspermission: { label: 'haspermission', category: '权限', editor: 'haspermission', desc: '权限检测' },
  has_property: { label: 'has_property', category: '属性', editor: 'has_property', desc: '实体属性筛选' },
}

// 参数种类分组（决定添加时下拉菜单的顺序）
export const PARAM_KIND_GROUPS = [
  { label: '坐标', keys: ['x', 'y', 'z', 'dx', 'dy', 'dz'] },
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
