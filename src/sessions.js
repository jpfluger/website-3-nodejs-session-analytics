// https://github.com/tj/connect-redis
var path = require('path')
var util = require('util')
var parseurl = require('parseurl')
var moment = require('moment')
var _ = require('lodash')
var session = require('express-session')
var RedisStore = require('connect-redis')(session)
var maxmind = require('maxmind')
var uaParser = require('ua-parser-js')
var getHeaerIP = require('ipware')().get_ip

var db = null
var ipLookup = null
var mwSession = null

// saved in redis
var globalStats = null
var KEY_REDIS_GLOBALSTATS = 'globalStats-' + (process.env.MYAPPNAME ? process.env.MYAPPNAME : 'unknownAppName')

exports.getGlobalStats = function () {
  return globalStats
}

exports.getIPLookup = function () {
  if (!ipLookup) {
    // initialize MaxMind
    // https://github.com/runk/node-maxmind
    // uses watchForUpdates to support reloading when changes occur to the mmdb file
    ipLookup = maxmind.openSync(path.resolve(path.join(__dirname, '../maxmind/GeoLite2-City.mmdb')), {
      cache: {
        max: 1000, // max items in cache
        maxAge: 1000 * 60 * 60 // life time in milliseconds
      },
      watchForUpdates: false
    })
  }
  return ipLookup
}

exports.initializeSessions = function (app, dbMod) {
  db = dbMod
  ipLookup = exports.getIPLookup(ipLookup)

  db.getRedisByKey(KEY_REDIS_GLOBALSTATS, function (err, data) {
    var defaults = {
      appName: (process.env.MYAPPNAME ? process.env.MYAPPNAME : 'unknownAppName'),
      lastSessionSaveDate: moment().toISOString(),
      ipo: {
        city: {}, continent: {}, isoCountry: {}, country: {}, latlon: {}, metroCode: {}, postalCode: {}, isoProvince: {}, isoProvinceFull: {}
      },
      uao: {
        browser: {name: {}, nameMajor: {}},
        engine: {name: {}, nameVersion: {}},
        os: {name: {}, nameVersion: {}},
        device: {model: {}, type: {}, vendor: {}},
        cpu: {architecture: {}}
      },
      views: {},
      stringify: function () {
        return JSON.stringify(globalStats, null, 2)
      }
    }

    if (!err && data) {
      // db.logDebug(data)
      console.log(util.format('initing new globalStats from redis where key=%s', KEY_REDIS_GLOBALSTATS))
      globalStats = _.merge(defaults, JSON.parse(data))
    } else {
      console.log(util.format('initing new globalStats b/c could not find in redis where key=%s: error? %s', KEY_REDIS_GLOBALSTATS, err))
      globalStats = defaults
    }
  })

  // initializing the session object
  mwSession = session({
    // https://github.com/expressjs/session#options
    // touch added, so resave can be false: https://github.com/tj/connect-redis/issues/142
    store: new RedisStore({client: db.getConnRedis()}),
    secret: 'redis-secret-123',
    resave: false,
    saveUninitialized: false
  })

  app.use(mwSessionRetry)

  // add the global session handler (handles IP and User-Agent parsing)
  app.use(mwGlobalSessions)
}

// retry session connection (optional)
// https://github.com/expressjs/session/issues/99#issuecomment-63853989
// https://github.com/tj/connect-redis#how-do-i-handle-lost-connections-to-redis
var mwSessionRetry = function (req, res, next) {
  var tries = 3

  function lookupSession (error) {
    if (error) {
      return next(error)
    }

    tries -= 1

    if (req.session !== undefined) {
      return next()
    }

    if (tries < 0) {
      return next(new Error('oh no'))
    }

    mwSession(req, res, lookupSession)
  }

  lookupSession()
}

var ipsRandomPublic = exports.ipsRandomPublic = [
  '98.138.252.38', // www.yahoo.com
  '23.36.32.101', // www.microsoft.com
  '172.217.8.164', // www.google.com
  '23.57.64.232', // www.apple.com
  '119.63.198.132', // www.baidu.jp Japan
  '103.235.46.39', // www.baidu.cn China
  '195.226.80.133', // www.medacom.com
  '165.206.254.134', // www.iowa.gov
  '71.6.189.45', // www.cedar-rapids.org
  '38.106.5.189', // www.cityofmarion.org
  '54.163.225.50', // www.icgov.org
  '164.151.129.19', // www.gov.za South Africa
  '172.217.8.163', // www.google.com.hk Hong Kong
  '87.98.231.40', // www.korea-dpr.com North Korea
  '174.35.59.209', // www.korea.net South Korea
  '195.47.234.39', // www.mofa.gov.sa Saudi Arabia
  '147.237.0.206', // www.gov.il Israel
  '89.184.73.91', // www.oxford.odessa.ua Oxford Lang Center - Odessa, Ukraine
  '72.52.219.120' // www.linnmar.k12.ia.us
]

var getRandomValidIP = function () {
  return ipsRandomPublic[Math.floor(Math.random() * ipsRandomPublic.length)]
}

var getIPObject = exports.getIPObject = function (ip) {
  var ipo = { isFound: false, city: null, continent: null, isoCountry: null, country: null, lat: null, lon: null, metroCode: null, postalCode: null, isoProvince: null, isoProvinceFull: null }
  if (ip) {
    ipo.isFound = true
    if (ip.city) {
      ipo.city = ip.city.names.en
    }
    if (ip.continent) {
      ipo.continent = ip.continent.names.en
    }
    if (ip.country) {
      if (ip.country.iso_code) {
        ip.country.isoCountry = ip.country.iso_code
      }
      ipo.country = ip.country.names.en
    }
    if (ip.location) {
      ipo.lat = ip.location.latitude
      ipo.lon = ip.location.longitude
      if (ip.location.metro_code) {
        ipo.metroCode = ip.location.metro_code
      }
    }
    if (ip.postal && ip.postal.code) {
      ipo.postalCode = ip.postal.code
    }
    if (ip.subdivisions && ip.subdivisions.length > 0) {
      ipo.isoProvince = ip.subdivisions[0].iso_code
      if (ip.subdivisions[0].names) {
        ipo.isoProvinceFull = ip.subdivisions[0].names.en
      }
    }
  }
  return ipo
}

var plusOneOrZero = function (value) {
  if (value) {
    return value + 1
  } else {
    return 1
  }
}

var plusOne = function (obj, key, key2) {
  if (!key) {
    obj['unknown'] = plusOneOrZero(obj['unknown'])
  } else {
    if (key2) {
      key = key + '-' + key2
    }
    obj[key.trim().toLowerCase()] = plusOneOrZero(obj[key.trim().toLowerCase()])
  }
  return obj
}

var updateIPStatCounts = function (ipo) {
  // not using plusOne b/c entire object is copied as param and data could get large

  // var ipo = {isFound: false, city:null, continent:null, isoCountry: null, country: null, lat: null, lon: null, metroCode: null, postalCode: null, isoProvince: null, isoProvinceFull: null}
  // city: {}, continent: {}, isoCountry: {}, country: {}, latlon: {}, metroCode: {}, postalCode: {}, isoProvince: {}, isoProvinceFull: {}}
  if (!ipo.city) { globalStats.ipo.city['unknown'] = plusOneOrZero(globalStats.ipo.city['unknown']) } else { globalStats.ipo.city[ipo.city.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.city[ipo.city.trim().toLowerCase()]) }
  if (!ipo.continent) { globalStats.ipo.continent['unknown'] = plusOneOrZero(globalStats.ipo.continent['unknown']) } else { globalStats.ipo.continent[ipo.continent.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.continent[ipo.continent.trim().toLowerCase()]) }
  if (!ipo.isoCountry) { globalStats.ipo.isoCountry['unknown'] = plusOneOrZero(globalStats.ipo.isoCountry['unknown']) } else { globalStats.ipo.isoCountry[ipo.isoCountry.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.isoCountry[ipo.isoCountry.trim().toLowerCase()]) }
  if (!ipo.country) { globalStats.ipo.country['unknown'] = plusOneOrZero(globalStats.ipo.country['unknown']) } else { globalStats.ipo.country[ipo.country.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.country[ipo.country.trim().toLowerCase()]) }
  if (!ipo.lat || !ipo.lon) {
    globalStats.ipo.latlon['unknown'] = plusOneOrZero(globalStats.ipo.latlon['unknown'])
  } else {
    var keyLatLon = util.format('(%s,%s)', ipo.lat, ipo.lon)
    globalStats.ipo.latlon[keyLatLon] = plusOneOrZero(globalStats.ipo.latlon[keyLatLon])
  }
  if (!ipo.metroCode) { globalStats.ipo.metroCode['unknown'] = plusOneOrZero(globalStats.ipo.metroCode['unknown']) } else { globalStats.ipo.metroCode[ipo.metroCode] = plusOneOrZero(globalStats.ipo.metroCode[ipo.metroCode]) }
  if (!ipo.postalCode) { globalStats.ipo.postalCode['unknown'] = plusOneOrZero(globalStats.ipo.postalCode['unknown']) } else { globalStats.ipo.postalCode[ipo.postalCode.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.postalCode[ipo.postalCode.trim().toLowerCase()]) }
  if (!ipo.isoProvince) { globalStats.ipo.isoProvince['unknown'] = plusOneOrZero(globalStats.ipo.isoProvince['unknown']) } else { globalStats.ipo.isoProvince[ipo.isoProvince.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.isoProvince[ipo.isoProvince.trim().toLowerCase()]) }
  if (!ipo.isoProvinceFull) { globalStats.ipo.isoProvinceFull['unknown'] = plusOneOrZero(globalStats.ipo.isoProvinceFull['unknown']) } else { globalStats.ipo.isoProvinceFull[ipo.isoProvinceFull.trim().toLowerCase()] = plusOneOrZero(globalStats.ipo.isoProvinceFull[ipo.isoProvinceFull.trim().toLowerCase()]) }
}

var updateGlobalStatCounts = function (ua) {
  if (!ua) {
    return
  }
  /*
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/58.0.3029.110 Chrome/58.0.3029.110 Safari/537.36',
    browser: { name: 'Chromium', version: '58.0.3029.110', major: '58' },
      engine: { version: '537.36', name: 'WebKit' },
      os: { name: 'Ubuntu' },
      device: {},
      cpu: { architecture: 'amd64' }
    }
  */

  globalStats.uao.browser.name = plusOne(globalStats.uao.browser.name, ua.browser.name)
  globalStats.uao.browser.nameMajor = plusOne(globalStats.uao.browser.nameMajor, ua.browser.name, ua.browser.major)

  globalStats.uao.engine.name = plusOne(globalStats.uao.engine.name, ua.engine.name)
  globalStats.uao.engine.nameVersion = plusOne(globalStats.uao.engine.nameVersion, ua.engine.name, ua.engine.version)

  globalStats.uao.os.name = plusOne(globalStats.uao.os.name, ua.os.name)
  globalStats.uao.os.nameVersion = plusOne(globalStats.uao.os.nameVersion, ua.os.name, ua.os.version)

  globalStats.uao.device.model = plusOne(globalStats.uao.device.model, ua.device.model)
  globalStats.uao.device.type = plusOne(globalStats.uao.device.type, ua.device.type)
  globalStats.uao.device.vendor = plusOne(globalStats.uao.device.vendor, ua.device.vendor)

  globalStats.uao.cpu.architecture = plusOne(globalStats.uao.cpu.architecture, ua.cpu.architecture)
}

exports.saveGlobalStatsInRedis = function () {
  db.setRedisByKey(KEY_REDIS_GLOBALSTATS, globalStats, function (err, reply) {
    if (err) {
      db.logDebug(util.format('could not save globalStats in redis where key=%s: %s', KEY_REDIS_GLOBALSTATS, err))
    }
  })
}

exports.saveGlobalStatsInPostgres = function (forceSave) {
  // save in db?
  if (forceSave || moment(globalStats.lastSessionSaveDate).add(1, 'hour').isBefore(moment.utc())) {
    // db.logDebug(JSON.stringify(globalStats))
    var newDate = moment().toISOString()

    db.sqlRun(db.sqlE.upsertGlobalStats.command, {appName: KEY_REDIS_GLOBALSTATS, stats: JSON.stringify(globalStats)}, function (err, result) {
      if (err) {
        console.log(util.format('could not save to postgres "global_stats" where appName=%s', KEY_REDIS_GLOBALSTATS))
      } else {
        db.logDebug(util.format('saved to postgres "global_stats" where appName=%s', KEY_REDIS_GLOBALSTATS))
      }

      // try again in an hour... even on failure or could bog down server with write-failures
      globalStats.lastSessionSaveDate = newDate
    })
  }
}

var mwGlobalSessions = function (req, res, next) {
  // --------------------------------------------------
  // Location/UA info once-only, when ip object hasn't been initialized
  // --------------------------------------------------

  // https://github.com/un33k/node-ipware
  if (!req.session.ipo) {
    var ipAddress = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prototype' ? getHeaerIP(req).clientIp : getRandomValidIP())

    if (ipAddress) {
      req.session.ipo = getIPObject(ipLookup.get(ipAddress))
    } else {
      req.session.ipo = getIPObject(null)
    }

    // parse the user-agent, then merge results into default values
    // defaults are found on https://github.com/faisalman/ua-parser-js
    req.session.ua = _.merge({
      ua: null,
      browser: { name: null, version: null, major: null },
      engine: { name: null, version: null },
      os: { name: null },
      device: { model: null, type: null, vendor: null },
      cpu: { architecture: null }
    }, uaParser(req.headers['user-agent']))

    // increment global ip object location statistics
    updateIPStatCounts(req.session.ipo)

    // increment global statistics counters
    updateGlobalStatCounts(req.session.ua)
  }

  // --------------------------------------------------
  // Views (everytime)
  // --------------------------------------------------

  // example: https://github.com/expressjs/session
  if (!req.session.views) {
    req.session.views = {}
  }

  // get the url pathname
  // https://github.com/pillarjs/parseurl
  var pathname = parseurl(req).pathname

  // count the views
  req.session.views[pathname] = (req.session.views[pathname] || 0) + 1

  // count the global views
  globalStats.views[pathname] = (globalStats.views[pathname] || 0) + 1

  // --------------------------------------------------
  // SAVE globalStats
  // --------------------------------------------------

  // save global stats redis
  exports.saveGlobalStatsInRedis()

  // db.logDebug(JSON.stringify(globalStats))

  // save in db
  exports.saveGlobalStatsInPostgres(false)

  // db.logDebug(req.session.ipo)
  // db.logDebug(req.session.ua)

  return next()
}
