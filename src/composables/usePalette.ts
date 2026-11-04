/**
 * EXPERIMENT: whether the Champions palette is on (`?palette=champions`, set on <html> before first paint in
 * index.html). Read once: switching it reloads the page.
 */
export const champions = document.documentElement.dataset.palette === 'champions'
