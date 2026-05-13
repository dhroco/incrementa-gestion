/**
 * Optional pre-deploy check: list duplicate (company_id, code) pairs in clause_company.
 * Usage: node scripts/check_clause_company_code_duplicates.js
 * Exit 1 if duplicates exist (code IS NOT NULL only; matches partial unique index semantics).
 */
const knexFactory = require('knex')
const knexConfig = require('../knexfile')

async function main() {
  const knex = knexFactory(knexConfig)
  try {
    const rows = await knex('clause_company')
      .select('company_id', 'code')
      .count('* as cnt')
      .whereNotNull('code')
      .groupBy('company_id', 'code')
      .havingRaw('count(*) > ?', [1])

    if (!rows.length) {
      console.log('OK: no duplicate (company_id, code) in clause_company.')
      process.exitCode = 0
      return
    }

    console.error('Found duplicate (company_id, code) groups:')
    for (const r of rows) {
      console.error(`  company_id=${r.company_id} code=${r.code} count=${r.cnt}`)
    }
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
