var util = require('util')
var fs = require('fs')
var path = require('path')
var _ = require('lodash')
var pg = require('pg')
var redis = require('redis')
var dbConfigs = {}
var connPG = null
var connRedis = null

/**********************************************
* Logging
*/

exports.logDebug = function (item) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(item)
  }
}

/**********************************************
* Connections
*/

exports.getConnRedis = function () {
  return connRedis
}

exports.getConnPostgres = function () {
  return connPG
}

var createRedisConn = function () {
  return new Promise(function (resolve, reject) {
    if (connRedis) {
      return resolve()
    }

    var config = _.merge({host: 'localhost', port: 6379, database: 1}, dbConfigs.redis)

    // https://github.com/NodeRedis/node_redis
    connRedis = redis.createClient({host: config.host, port: config.port, db: config.database})

    connRedis.on('ready', function () {
      resolve()
    })

    connRedis.on('error', function (err) {
      throw new Error(util.format('redis init error: %s', err))
    })
  })
}

var doSqlLogging = (process.env.NODE_ENV !== 'production')

var logSql = function (text, values) {
  console.log(util.format('sqlRun: %s ; values=%s', text, values))
}

// pg help:
// https://github.com/brianc/node-postgres
// https://github.com/brianc/node-postgres/wiki/FAQ

var createPostgresConn = function () {
  return new Promise(function (resolve, reject) {
    var config = _.merge({host: 'localhost', port: 5432, database: 'mydb', user: 'myuser', password: 'mypassword', max: 10, idleTimeoutMillis: 30000}, dbConfigs.postgres)

    connPG = new pg.Pool(config)
    connPG.on('error', function (err, client) {
      // if an error is encountered by a client while it sits idle in the pool
      // the pool itself will emit an error event with both the error and
      // the client which emitted the original error
      // this is a rare occurrence but can happen if there is a network partition
      // between your application and the database, the database restarts, etc.
      // and so you might want to handle it and at least log it out
      console.error('idle client error', err.message, err.stack)
    })

    resolve()
  })
}

// a variation of: https://github.com/pihvi/yesql
// https://github.com/pihvi/yesql/blob/master/yesql.js
var getSqlNamedParams = function (query, data, isStrict) {
  var values = []
  return {
    text: query.replace(/(::?)([a-zA-Z0-9_]+)/g, function (_, prefix, key) {
      if (prefix !== ':') {
        return prefix + key
      } else if (!data) {
        if (!isStrict) {
          return prefix + key
        } else {
          throw new Error(util.format('No custom data to parse'))
        }
      } else if (key in data) {
        values.push(data[key])
        return '$' + values.length
      } else {
        if (!isStrict) {
          return prefix + key
        } else {
          throw new Error(util.format('Missing value for statement when key=%s'))
        }
      }
    }),
    values: values
  }
}

// var obj
// obj = getSqlNamedParams('UPDATE pokemon SET price = :price;', {price: JSON.stringify({price: 5})})
// obj = getSqlNamedParams('UPDATE pokemon SET price = :price;', {price: 5})
// obj = getSqlNamedParams('UPDATE pokemon SET price = ":price";', {ticket:'sss'})
// obj = getSqlNamedParams('UPDATE pokemon SET price = ":price";', null)
// obj = getSqlNamedParams('UPDATE pokemon SET price = ":price";')
// console.log(obj.text)
// console.log(obj.values)

/**********************************************
* Redis
*
* connect from command-line: redis-cli
* show available databases:  info keyspace
* use a database: select 1
* show all keys: keys *
* show value by key: get KEYNAME
*/

exports.getRedisByKey = function (key, callback) {
  if (!key) {
    callback && callback(new Error('key is not defined'), null)
  } else {
    connRedis.get(key, callback)
  }
}

exports.setRedisByKey = function (key, value, callback) {
  if (!key) {
    callback && callback(new Error('key is not defined'), null)
  } else {
    if (!value) {
      connRedis.set(key, null, callback)
    } else {
      connRedis.set(key, JSON.stringify(value), callback)
    }
  }
}

/**********************************************
* Postgres
*/

exports.sqlRun = function (text, values, callback) {
  // ref: https://github.com/brianc/node-postgres
  // ref: https://github.com/brianc/node-pg-pool/blob/master/index.js

  if (!_.isString(text)) {
    if (typeof values !== 'function') {
      values = text.values
    }
    text = text.command
  }

  if (typeof values === 'function') {
    callback = values
    values = undefined
  } else if (!values) {
    values = undefined
  } else if (Array.isArray(values)) {
    if (values.length === 0) {
      values = undefined
    }
  } else {
    var sqlParams = getSqlNamedParams(text, values)
    text = sqlParams.text
    values = sqlParams.values
  }

  if (doSqlLogging) {
    logSql(text, values)
  }

  // by default uses promises
  return connPG.query(text, values, callback)
}

// the pool also supports checking out a client for
// multiple operations, such as a transaction
// or reading in a sql file
exports.connectClient = function (callback) {
  return connPG.connect(callback)
}

var hasSchemaVersion = function () {
  return new Promise(function (resolve, reject) {
/*
    // is version available?
    exports.sqlRun('SELECT schema FROM version', function (err, res) {
      if (err) {
        throw new Error(util.format('Has the db been initialized? schema check failed: %s', err))
      } else {
        resolve()
      }
    })
*/
    // is version available?
    exports.sqlRun(exports.sqlE.getVersion, function (err, res) {
      if (!err) {
        // success!
        // console.log(res)
        console.log(util.format('found db version schema=%s', res.rows[0].schema))
        return resolve()
      }

      // no, then let's try importing the schema into the db
      // import file: https://stackoverflow.com/questions/22636388/import-sql-file-in-node-js-and-execute-against-postgresql
      var sql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString()

      exports.connectClient(function (err, client, done) {
        if (err) {
          throw new Error(util.format('checkVersionTryInit: %s', err))
        }

        console.log('trying to init db with schema.sql')

        client.query(sql, function (err, result) {
          done()

          if (err) {
            throw new Error(util.format('checkVersionTryInit: %s', err))
          } else {
            exports.sqlRun(exports.sqlE.getVersion, function (err, res) {
              if (!err) {
                // success!
                // console.log(res)
                console.log(util.format('found db version schema=%s', res.rows[0].schema))
                return resolve()
              }

              throw new Error(util.format('unable to initialize db'))
            })
          }
        })
      })
    })
  })
}

exports.initDb = function (configs) {
  dbConfigs = _.merge(dbConfigs, configs)

  return new Promise(function (resolve, reject) {
    createRedisConn()
    .then(createPostgresConn)
    .then(hasSchemaVersion)
    .then(function () {
      console.log('initDb successful')
      resolve()
    })
    .catch(function (err) {
      console.log('initDb failed: ' + err)
      reject(err)
    })
  })
}

/**********************************************
* Sql Expressions
*   different paradigms exist for interacting with db
*   since this is a demo, putting all queries in one spot
*   but in a prod app modularize as needed
*/

exports.sqlE = {
  getVersion: {command: 'SELECT schema FROM version'},
  upsertGlobalStats: {command: 'INSERT INTO "global_stats" AS gs ("appName", "stats") VALUES (:appName, :stats) ON CONFLICT ("appName") DO UPDATE SET "stats" = :stats WHERE gs."appName" = :appName;'}
}
