/**********************************************
* Required db libraries
*/
var db = require('./db.js')

db.initDb()
.then(function () {
  console.log('app-level initDb completed')
  runApp()
})
.catch(function (err) {
  console.log('fatal error: ' + err)
  process.exit(1)
})

var runApp = function () {
  /**********************************************
  * Required server libraries
  */

  // see: http://markojs.com/docs/express/
  require('marko/node-require')

  var express = require('express')
  var app = express()
  var path = require('path')
  var markoExpress = require('marko/express')

  /**********************************************
  * Serve STATIC files that are available to the public
  */

  app.use('/public', express.static('public'))
  // if not using /public/_third directly, then map-in the folder bower_components/
  // app.use('/public/_third', express.static(path.join(__dirname, 'bower_components')))

  /**********************************************
  * Sessions
  */

  // placed AFTER "public" static files since for this demo we don't require the session in order to serve a public file
  // if placed BEFORE, then before each public file is served, the session will be checked
  var mySessions = require('./sessions.js')
  mySessions.initializeSessions(app, db)
  db.logDebug('initialized sessions')

  /**********************************************
  * Marko templates
  */

  var marko = {}

  // https://github.com/marko-js/marko/blob/master/src/express.js
  var renderMarkoTemplate = function (res, pathToFile, data) {
    if (!marko[pathToFile]) {
      marko[pathToFile] = require(path.resolve(path.join(__dirname, '../' + pathToFile)))
    }

    // it's okay if data is null
    res.marko(marko[pathToFile], data)
  }

  // app.use(markoExpress()) //enable res.marko(template, data)

  /**********************************************
  * Routes
  */

  app.get('/', function (req, res) {
    res.redirect('/home')
  })

  app.get('/home', markoExpress(), function (req, res) {
    renderMarkoTemplate(res, 'views/home.marko')
  })

  app.get('/time', markoExpress(), function (req, res) {
    renderMarkoTemplate(res, 'views/time.marko', {time: new Date().toLocaleString()})
  })

  app.get('/analytics/site-usage', markoExpress(), function (req, res) {
    renderMarkoTemplate(res, 'views/analytics/site-usage.marko', {globalStats: mySessions.getGlobalStats()})
  })

  /**********************************************
  * Error handling
  */

  app.use(markoExpress(), function (req, res, next) {
    res.status(404)
    renderMarkoTemplate(res, 'views/404.marko')
  })

  app.use(markoExpress(), function (err, req, res, next) {
    db.logDebug(err)
    res.status(500)
    renderMarkoTemplate(res, 'views/500.marko')
  })

  app.listen(8080, function () {
    console.log('Sample app listening on http://localhost:8080')
  })
}
