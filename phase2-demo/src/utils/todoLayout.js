// Keep at least 470px for task content plus a 320px assistant and panel spacing.
export function shouldCollapseTodoAssistant(availableWidth) {
  return availableWidth > 0 && availableWidth < 814
}
