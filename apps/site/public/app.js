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

const docsContent = document.querySelector('.docs-guide .docs-content')
const docsLinks = [...document.querySelectorAll('.docs-guide .docs-sidebar a')]
const docsArticles = [...document.querySelectorAll('.docs-guide .docs-content article')]

function setActiveGuideLink(id) {
  docsLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${id}`
    link.classList.toggle('active', isActive)
    if (isActive) link.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

docsLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const selector = link.getAttribute('href')
    const target = selector ? document.querySelector(selector) : null
    if (!target || !docsContent) return
    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveGuideLink(target.id)
    history.replaceState(null, '', selector)
  })
})

docsContent?.addEventListener('scroll', () => {
  const top = docsContent.getBoundingClientRect().top + 36
  const visible = docsArticles.reduce((current, article) => {
    return article.getBoundingClientRect().top <= top ? article : current
  }, docsArticles[0])
  if (visible) setActiveGuideLink(visible.id)
})
