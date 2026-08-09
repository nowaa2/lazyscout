const navToggle = document.querySelector('.nav-toggle')
const nav = document.querySelector('.site-nav')

navToggle?.addEventListener('click', () => {
  const isOpen = nav?.classList.toggle('open') ?? false
  navToggle.setAttribute('aria-expanded', String(isOpen))
})

document.querySelectorAll('.site-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    nav?.classList.remove('open')
    navToggle?.setAttribute('aria-expanded', 'false')
  })
})

document.querySelectorAll('.copy-button').forEach((button) => {
  button.addEventListener('click', async () => {
    const command = button.dataset.copy
    if (!command) return
    await navigator.clipboard.writeText(command)
    const original = button.textContent
    button.textContent = 'Copied'
    window.setTimeout(() => {
      button.textContent = original
    }, 1500)
  })
})
