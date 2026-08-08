document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-modal], [data-drawer], [data-close]')
  if (!trigger) return
  if (trigger.dataset.modal) document.querySelector(trigger.dataset.modal)?.classList.remove('hidden')
  if (trigger.dataset.drawer) document.querySelector(trigger.dataset.drawer)?.classList.remove('hidden')
  if (trigger.dataset.close) document.querySelector(trigger.dataset.close)?.classList.add('hidden')
})
document.querySelectorAll('[data-tabs]').forEach((tabs) => {
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]'); if (!button) return
    tabs.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('active', item === button))
    const root = tabs.parentElement
    root.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.tab))
  })
})
document.querySelectorAll('[data-accordion]').forEach((item) => item.addEventListener('click', () => item.toggleAttribute('open')))
const apiStatus = document.querySelector('[data-api-status]')
if (apiStatus) fetch('/api/health.json').then((response) => response.json()).then((data) => { apiStatus.textContent = `API ${data.status.toUpperCase()} · ${data.service}` }).catch(() => { apiStatus.textContent = 'API unavailable' })
if (location.pathname === '/dashboard' && !apiStatus) { const status = document.createElement('span'); status.className = 'pill'; status.textContent = 'Checking API…'; document.querySelector('.dashboard-head > div')?.append(status); fetch('/api/health.json').then((response) => response.json()).then((data) => { status.textContent = `API ${data.status.toUpperCase()} · ${data.service}` }).catch(() => { status.textContent = 'API unavailable' }) }
