const config = require('./config')
const { createApp } = require('./app')
const { db } = require('./db/knex')
const { storageService } = require('./services/storageService')
const emailService = require('./services/emailService')
const { createFirmeSigningService } = require('./services/firmeSigningService')

const firmeSigningService = createFirmeSigningService({
  db,
  storageService,
  emailService,
  snsTopicArn: process.env.FIRME_SNS_TOPIC_ARN || null
})

const app = createApp({ firmeSigningService })

app.listen(config.PORT, config.HOST, () => {
  console.log(`Server running on ${config.HOST}:${config.PORT} in ${config.ENVIRONMENT} mode`)
})
