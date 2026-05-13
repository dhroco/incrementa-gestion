import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function readCss() {
  const file = path.resolve(process.cwd(), 'src/components/RichTextEditor/styles.module.css')
  return fs.readFileSync(file, 'utf-8')
}

describe('RichTextEditor styles (heading bold differentiation)', () => {
  it('sets a lighter base weight for H1/H2/H3 and heavier weight for strong/b inside headings (editor)', () => {
    const css = readCss()

    expect(css).toContain('.editor-content :global(.ProseMirror h1)')
    expect(css).toMatch(/\.editor-content\s+:global\(\.ProseMirror h1\)\s*\{[\s\S]*font-weight:\s*500;/)
    expect(css).toMatch(/\.editor-content\s+:global\(\.ProseMirror h2\)\s*\{[\s\S]*font-weight:\s*500;/)
    expect(css).toMatch(/\.editor-content\s+:global\(\.ProseMirror h3\)\s*\{[\s\S]*font-weight:\s*500;/)

    expect(css).toMatch(/\.editor-content\s+:global\(\.ProseMirror h1 strong\),[\s\S]*\{[\s\S]*font-weight:\s*700;/)
    expect(css).toMatch(/\.editor-content\s+:global\(\.ProseMirror h2 strong\),[\s\S]*\{[\s\S]*font-weight:\s*700;/)
    expect(css).toMatch(/\.editor-content\s+:global\(\.ProseMirror h3 strong\),[\s\S]*\{[\s\S]*font-weight:\s*700;/)
  })

  it('applies the same differentiation for the embedded read-only preview', () => {
    const css = readCss()

    expect(css).toMatch(/\.embedded-clause-preview-editor\s+:global\(\.ProseMirror h1\)\s*\{[\s\S]*font-weight:\s*500;/)
    expect(css).toMatch(/\.embedded-clause-preview-editor\s+:global\(\.ProseMirror h2\)\s*\{[\s\S]*font-weight:\s*500;/)
    expect(css).toMatch(/\.embedded-clause-preview-editor\s+:global\(\.ProseMirror h3\)\s*\{[\s\S]*font-weight:\s*500;/)

    expect(css).toMatch(/\.embedded-clause-preview-editor\s+:global\(\.ProseMirror h1 strong\),[\s\S]*\{[\s\S]*font-weight:\s*700;/)
    expect(css).toMatch(/\.embedded-clause-preview-editor\s+:global\(\.ProseMirror h2 strong\),[\s\S]*\{[\s\S]*font-weight:\s*700;/)
    expect(css).toMatch(/\.embedded-clause-preview-editor\s+:global\(\.ProseMirror h3 strong\),[\s\S]*\{[\s\S]*font-weight:\s*700;/)
  })
})

