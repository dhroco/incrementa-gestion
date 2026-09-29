import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function readCss() {
  const file = path.resolve(process.cwd(), 'src/components/RichTextEditor/styles.module.css')
  return fs.readFileSync(file, 'utf-8')
}

describe('RichTextEditor dynamic text chip', () => {
  it('Editor chip is marked dynamic text', () => {
    const css = readCss()
    expect(css).toMatch(
      /\.variable-node\[data-kind="dynamic_text"\]\s*\{[^}]*background:\s*var\(--color-form-field-readonly-bg\)/
    )
    expect(css).toMatch(
      /\.variable-node\[data-kind="dynamic_text"\]\s*\{[^}]*border-color:\s*var\(--color-selection\)/
    )
    expect(css).toMatch(
      /\.variable-node\[data-kind="dynamic_text"\]\s*\{[^}]*color:\s*var\(--color-selection\)/
    )
    expect(css).toMatch(
      /\.variable-node\[data-kind="dynamic_text"\]:hover\s*\{[^}]*border-color:\s*var\(--color-main-headerbar\)/
    )
    expect(css).toMatch(
      /\.variable-node\[data-kind="dynamic_text"\]:hover\s*\{[^}]*color:\s*var\(--color-main-headerbar\)/
    )
  })
})
