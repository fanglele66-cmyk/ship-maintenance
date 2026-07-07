import re

with open(r'c:\Users\27690\WorkBuddy\2026-06-26-12-26-10\src\views\ProductDrawer.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace checkItems mock data
idx1 = content.find("title: '液压系统故障排查'")
idx2 = content.find("status: 'pending',\n        feedback: null\n      }\n    ]")

if idx1 >= 0 and idx2 >= 0:
    old_items = content[idx1-8:idx2+len("status: 'pending',\n        feedback: null\n      }\n    ]")]
    # Write replacement to a temp file to avoid shell escaping issues
    pass

# Let me do a simpler approach: replace just key sections
# 1. submitFeedback changes
old_submit = '''  closeFeedbackModal()

  // auto next or repair
  if (!hasAbnormal) {
    if (idx + 1 < items.length && items[idx + 1].status === 'pending') {
      items[idx + 1].status = 'active'
    }
    checkAllDone()
  }
  // abnormal: don't auto-advance, show repair inline
  else {
    eventAssistantAction[props.event.id] = 'check_abnormal_' + idx
  }'''

new_submit = '''  closeFeedbackModal()

  // 正常项 → 激活下一项
  if (!hasAbnormal) {
    if (idx + 1 < items.length && items[idx + 1].status === 'pending') {
      items[idx + 1].status = 'active'
    }
    checkAllDone()
  }
  // 异常项 → 卡片内联展示维修方案 + 通知助手
  else {
    eventAssistantAction[props.event.id] = 'check_abnormal_' + idx
  }'''

if old_submit in content:
    content = content.replace(old_submit, new_submit)
    print("1. submitFeedback updated")
else:
    # Check what's actually there
    marker = content.find("closeFeedbackModal()")
    if marker >= 0:
        print(f"Found closeFeedbackModal at {marker}: {repr(content[marker:marker+300])}")
    else:
        print("closeFeedbackModal NOT FOUND")

# 2. Add markItemRepaired/markItemRepairFailed
old_ra = '''function resolveEvent() {
  if (!props.event) return
  const eid = props.event.id
  eventStage[eid] = 'S5'
  eventAssistantAction[eid] = 'report'
}

function continueCheck() {
  if (!props.event) return
  const eid = props.event.id
  eventStage[eid] = 'S2'
  const items = product.value?.check?.checkItems
  if (items) {
    items.forEach(item => {
      if (item.status === 'done-abnormal' && !item.repaired) {
        item.status = 'active'
        item.feedback = null
      }
    })
  }
  eventAssistantAction[eid] = 'restart_check'
}'''
if old_ra in content:
    print("2. Found old resolveEvent/continueCheck")
else:
    print("2. NOT FOUND - checking")
    print(repr(content[content.find("resolveEvent"):][:200]))

with open(r'c:\Users\27690\WorkBuddy\2026-06-26-12-26-10\src\views\ProductDrawer.vue', 'w', encoding='utf-8') as f:
    f.write(content)
