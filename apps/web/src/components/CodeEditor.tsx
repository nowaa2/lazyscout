import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'

type Props = { value: string; framework: 'playwright' | 'cypress'; onChange: (value: string) => void }
type Framework = Props['framework']

export function CodeEditor({ value, framework, onChange }: Props) {
  function handleMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    const language = 'typescript'
    const suggestions =
      framework === 'playwright'
        ? [
            'page.goto()',
            'page.getByRole()',
            'page.getByLabel()',
            'page.getByText()',
            'page.locator()',
            'page.waitForTimeout()',
            'await page.screenshot({ path: "evidence.png", fullPage: true })',
            'expect(page).toHaveURL()',
            'expect(locator).toBeVisible()',
            'expect(locator).toContainText()'
          ]
        : [
            'cy.visit()',
            'cy.findByRole()',
            'cy.get()',
            'cy.contains()',
            'cy.wait()',
            'cy.url().should()',
            "locator.should('be.visible')",
            "locator.should('contain.text')"
          ]
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.', '('],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const lineBeforeCursor = model
          .getLineContent(position.lineNumber)
          .slice(0, position.column - 1)
          .toLowerCase()
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: position.column
        }
        const naturalLanguageSuggestions = getNaturalLanguageSuggestions(lineBeforeCursor, framework)
        return {
          suggestions: [
            ...suggestions.map((label) => ({
              label,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: label,
              range,
              detail: framework === 'playwright' ? 'Playwright API' : 'Cypress API'
            })),
            ...naturalLanguageSuggestions.map((item) => ({
              ...item,
              kind: monaco.languages.CompletionItemKind.Snippet,
              range
            }))
          ]
        }
      }
    })
    editor.onDidDispose(() => disposable.dispose())
  }
  return (
    <Editor
      height="calc(100vh - 420px)"
      theme="vs-dark"
      language="typescript"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={handleMount as OnMount}
      options={{
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 13,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'off',
        tabSize: 2,
        insertSpaces: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        padding: { top: 16, bottom: 16 }
      }}
    />
  )
}

function getNaturalLanguageSuggestions(
  line: string,
  framework: Framework
): Array<{ label: string; insertText: string; detail: string }> {
  const playwright = framework === 'playwright'
  const suggestions: Array<{ label: string; insertText: string; detail: string }> = []
  if (/กรอก|พิมพ์|fill|type|input/i.test(line)) {
    suggestions.push({
      label: 'กรอกข้อมูลในช่อง (fill)',
      insertText: playwright
        ? "await page.getByLabel('${1:Email}').fill('${2:value}')"
        : "cy.findByLabelText('${1:Email}').type('${2:value}')",
      detail: 'เดาจากคำสั่งกรอก/พิมพ์'
    })
  }
  if (/คลิก|กด|click|press|ปุ่ม/i.test(line)) {
    suggestions.push({
      label: 'คลิกปุ่ม (click)',
      insertText: playwright
        ? "await page.getByRole('button', { name: '${1:Login}' }).click()"
        : "cy.findByRole('button', { name: '${1:Login}' }).click()",
      detail: 'เดาจากคำสั่งคลิก/กดปุ่ม'
    })
  }
  if (/เปิดหน้า|ไปที่|navigate|visit|goto/i.test(line)) {
    suggestions.push({
      label: 'เปิดหน้า URL (navigate)',
      insertText: playwright ? "await page.goto('${1:https://example.com}')" : "cy.visit('${1:https://example.com}')",
      detail: 'เดาจากคำสั่งเปิดหน้า'
    })
  }
  if (/ตรวจสอบ|เช็ค|assert|expect|verify|เห็นข้อความ|ข้อความ/i.test(line)) {
    suggestions.push({
      label: 'ตรวจสอบข้อความ (assert text)',
      insertText: playwright
        ? "await expect(page.getByText('${1:Success}')).toBeVisible()"
        : "cy.contains('${1:Success}').should('be.visible')",
      detail: 'เดาจากคำสั่งตรวจสอบ'
    })
  }
  return suggestions
}
