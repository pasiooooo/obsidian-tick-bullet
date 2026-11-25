const english = {
  commands: {
    toggle: 'Toggle timestamp on the current bullet', short: 'Add or update short time at line start',
    long: 'Add or update long time at line start', end: 'Add or update short time at line end',
  },
  shortFormat: 'Short time format', longFormat: 'Long time format',
  preview: (stamp: string) => `Example: - ${stamp} Note text`,
  prefix: 'Time prefix', suffix: 'Time suffix', none: 'None',
  prefixHint: 'Before the time, e.g. the opening bracket in [12:34].',
  suffixHint: 'After the time, e.g. the closing bracket in [12:34].',
  removeOnIndent: 'Remove time when indenting', removeHint: 'Keep the text of the child item.',
  inheritSiblings: 'Follow the previous sibling', inheritHint: 'Use the nearest sibling’s time format when creating a bullet or returning to its level.',
};

const chinese: typeof english = {
  commands: {
    toggle: '切换当前条目的时间', short: '在行首添加或更新短时间',
    long: '在行首添加或更新长时间', end: '在行尾添加或更新短时间',
  },
  shortFormat: '短时间格式', longFormat: '长时间格式',
  preview: stamp => `示例：- ${stamp} 正文`,
  prefix: '时间前缀', suffix: '时间后缀', none: '无',
  prefixHint: '放在时间前，例如 [12:34] 的左括号。', suffixHint: '放在时间后，例如 [12:34] 的右括号。',
  removeOnIndent: '缩进时移除时间', removeHint: '子条目的正文保持不变。',
  inheritSiblings: '继承同级条目的格式', inheritHint: '新建条目或退出子层级时，跟随目标层级最近的条目。',
};

const traditional: typeof english = {
  commands: {
    toggle: '切換目前項目的時間', short: '在行首新增或更新短時間',
    long: '在行首新增或更新長時間', end: '在行尾新增或更新短時間',
  },
  shortFormat: '短時間格式', longFormat: '長時間格式',
  preview: stamp => `範例：- ${stamp} 內文`,
  prefix: '時間前綴', suffix: '時間後綴', none: '無',
  prefixHint: '放在時間前，例如 [12:34] 的左括號。', suffixHint: '放在時間後，例如 [12:34] 的右括號。',
  removeOnIndent: '縮排時移除時間', removeHint: '子項目的內文保持不變。',
  inheritSiblings: '沿用同層項目的格式', inheritHint: '新增項目或返回上一層時，沿用該層最近項目的格式。',
};

export function labelsFor(locale: string) {
  const tag = locale.toLowerCase().replace(/_/g, '-');
  if (!/^zh(?:-|$)/.test(tag)) return english;
  return /-(?:hant|tw|hk|mo)(?:-|$)/.test(tag) ? traditional : chinese;
}
