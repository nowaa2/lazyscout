import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'

type Props = { value: string; framework: 'playwright' | 'cypress'; onChange: (value: string) => void }

export function CodeEditor({ value, framework, onChange }: Props) {
  function handleMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    const language = 'typescript'
    const suggestions = framework === 'playwright'
      ? ['page.goto()', 'page.getByRole()', 'page.getByLabel()', 'page.getByText()', 'page.locator()', 'page.waitForTimeout()', 'expect(page).toHaveURL()', 'expect(locator).toBeVisible()', 'expect(locator).toContainText()']
      : ['cy.visit()', 'cy.findByRole()', 'cy.get()', 'cy.contains()', 'cy.wait()', 'cy.url().should()', 'locator.should(\'be.visible\')', 'locator.should(\'contain.text\')']
    const disposable = monaco.languages.registerCompletionItemProvider(language, { triggerCharacters: ['.', '('], provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: position.column }
      return { suggestions: suggestions.map((label) => ({ label, kind: monaco.languages.CompletionItemKind.Method, insertText: label, range, detail: framework === 'playwright' ? 'Playwright API' : 'Cypress API' })) }
    } })
    editor.onDidDispose(() => disposable.dispose())
  }
  return <Editor height="calc(100vh - 420px)" theme="vs-dark" language="typescript" value={value} onChange={(next) => onChange(next ?? '')} onMount={handleMount as OnMount} options={{ automaticLayout: true, minimap: { enabled: true }, fontSize: 13, lineNumbers: 'on', folding: true, wordWrap: 'off', tabSize: 2, insertSpaces: true, scrollBeyondLastLine: false, smoothScrolling: true, suggestOnTriggerCharacters: true, quickSuggestions: true, padding: { top: 16, bottom: 16 } }} />
}
