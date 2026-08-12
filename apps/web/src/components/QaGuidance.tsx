export function QaGuidance({ sourceUrl, onUse }: { sourceUrl?: string; onUse: (code: string) => void }) {
  const url = sourceUrl || 'http://localhost:5500/login'
  const login = `await page.goto("${url}")\nawait page.getByLabel("Email address").fill("{{TEST_EMAIL}}")\nawait page.getByLabel("Password").fill("{{TEST_PASSWORD}}")\nawait page.getByRole("button", { name: "Login", exact: true }).click()\nawait expect(page).toHaveURL(new RegExp("/dashboard"))`
  const validation = `await page.goto("${url}")\nawait page.getByLabel("Password").fill("wrong-password")\nawait page.getByRole("button", { name: "Login", exact: true }).click()\nawait expect(page.getByRole("alert")).toContainText("Invalid password")`
  return (
    <section className="qa-guidance">
      <div>
        <p className="eyebrow">Beginner guide</p>
        <h3>What should I add next?</h3>
        <p>Use a template, then replace labels and expected results with what you observed.</p>
      </div>
      <div className="qa-guidance-actions">
        <button type="button" onClick={() => onUse(login)}>
          <b>Login success</b>
          <span>Fill credentials and verify the next URL</span>
        </button>
        <button type="button" onClick={() => onUse(validation)}>
          <b>Login validation</b>
          <span>Try an invalid password and assert the alert</span>
        </button>
        <span>For uploads, create a draft first and choose a safe test file before running.</span>
      </div>
    </section>
  )
}
