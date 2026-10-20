// Rebuild cached route views after Vue HMR has finished. Pinia stays mounted,
// retaining workflow progress and shared form drafts while replacing stale DOM.
export function installDevViewRecovery(hot, rebuildViews) {
  if (!hot) return () => {}
  const afterUpdate = ({ updates = [] }) => {
    if (updates.some(update => update.type === 'js-update' &&
      [update.path, update.acceptedPath].some(path => path?.split('?')[0].endsWith('.vue')))) {
      rebuildViews()
    }
  }
  hot.on('vite:afterUpdate', afterUpdate)
  return () => hot.off('vite:afterUpdate', afterUpdate)
}
