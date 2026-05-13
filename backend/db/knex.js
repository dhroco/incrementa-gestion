const knex = require('knex')
const knexfile = require('../knexfile')

/** @type {import('knex').Knex} */
const db = knex(knexfile)

module.exports = { db }

