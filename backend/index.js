const config = require('./config')
const { app } = require('./app')

app.listen(config.PORT, config.HOST, () => {
  console.log(`Server running on ${config.HOST}:${config.PORT} in ${config.ENVIRONMENT} mode`)
})
