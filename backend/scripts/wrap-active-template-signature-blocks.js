#!/usr/bin/env node
/**
 * Envuelve bloques de firma canónicos en plantillas estándar activas.
 *
 * Uso (desde backend/):
 *   source ./set-env-local.sh
 *   node scripts/wrap-active-template-signature-blocks.js --dry-run
 *   CONFIRM_WRAP_SIGNATURE_BLOCKS=YES node scripts/wrap-active-template-signature-blocks.js
 */

const { db } = require('../db/knex')
const { validateTemplateContentJson } = require('../utils/templateContentJson')
const {
  BACKUP_NOTE,
  wrapSignatureBlocksInDoc,
} = require('../utils/wrapTemplateSignatureBlocks')
const { applyManualSignatureWraps } = require('../utils/manualTemplateSignatureWraps')

function parseArgs(argv) {
  return { dryRun: argv.slice(2).includes('--dry-run') }
}

async function ensureBackup(knex, { templateId, contentJson, dryRun }) {
  const existing = await knex('template_content_backup')
    .where({ template_id: templateId, note: BACKUP_NOTE })
    .first()

  if (existing) return { inserted: false }

  if (dryRun) return { inserted: true, dryRun: true }

  await knex('template_content_backup').insert({
    template_id: templateId,
    content_json: contentJson,
    note: BACKUP_NOTE,
  })
  return { inserted: true }
}

async function processTemplate(knex, row, { dryRun }) {
  const code = row.code || row.id
  let doc = row.content_json

  if (!doc || typeof doc !== 'object') {
    return { code, status: 'reported', reason: 'content_json ausente o inválido' }
  }

  await ensureBackup(knex, { templateId: row.id, contentJson: doc, dryRun })

  const manual = applyManualSignatureWraps(doc, code)
  if (manual.applied) {
    doc = manual.doc
  }

  const result = wrapSignatureBlocksInDoc(doc)

  if (result.issues.length) {
    return {
      code,
      status: 'reported',
      reason: result.issues.join('; '),
    }
  }

  if (!result.changed) {
    return { code, status: 'skipped', reason: 'Ya envuelto o sin grupos canónicos' }
  }

  const validation = validateTemplateContentJson(result.doc, { required: true })
  if (!validation.ok) {
    return { code, status: 'reported', reason: validation.message || 'JSON inválido tras wrap' }
  }

  if (!dryRun) {
    await knex('template')
      .where({ id: row.id })
      .update({ content_json: result.doc, updated_at: knex.fn.now() })
  }

  return { code, status: 'wrapped', wrapped: result.wrapped, manual: manual.applied }
}

async function main() {
  const { dryRun } = parseArgs(process.argv)

  if (!dryRun && process.env.CONFIRM_WRAP_SIGNATURE_BLOCKS !== 'YES') {
    console.error('Abortado: use --dry-run o CONFIRM_WRAP_SIGNATURE_BLOCKS=YES para mutar.')
    process.exit(1)
  }

  const hasBackup = await db.schema.hasTable('template_content_backup')
  if (!hasBackup) {
    console.error('Falta tabla template_content_backup. Ejecute migrate:latest primero.')
    process.exit(1)
  }

  const rows = await db('template as t')
    .join('template_standard as ts', 'ts.id', 't.id')
    .select('t.id', 't.code', 't.content_json', 't.status')
    .where('t.status', 'active')
    .orderBy('t.code', 'asc')

  const summary = { wrapped: [], skipped: [], reported: [] }

  for (const row of rows) {
    const outcome = await processTemplate(db, row, { dryRun })
    if (outcome.status === 'wrapped') summary.wrapped.push(outcome)
    else if (outcome.status === 'reported') summary.reported.push(outcome)
    else summary.skipped.push(outcome)
  }

  console.log(JSON.stringify({ dryRun, activeCount: rows.length, ...summary }, null, 2))

  if (summary.reported.length) {
    console.error('\nPlantillas reportadas (requieren wrap manual):')
    for (const r of summary.reported) {
      console.error(`  ${r.code}: ${r.reason}`)
    }
  }

  await db.destroy()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await db.destroy()
  } catch {
    // ignore
  }
  process.exit(1)
})
