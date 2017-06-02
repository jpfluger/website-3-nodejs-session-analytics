/* eslint-env mocha */

// var assert = require('assert')
var util = require('util')
var _ = require('lodash')
var mySessions = require('../src/sessions.js')

/*
This might help with debugging
var printIPInfo = function (ip) {
  if (!ip) {
    db.logDebug('bad ip or ip not found')
  } else {
    // db.logDebug(ip);
    if (ip.city && ip.city.names) {
      db.logDebug(util.format('city: %s', ip.city.names.en))
    }
    if (ip.continent && ip.continent.names) {
      db.logDebug(util.format('continent: %s', ip.continent.names.en))
    }
    if (ip.country && ip.country.names) {
      db.logDebug(util.format('country: %s', ip.country.names.en))
    }
    db.logDebug(util.format('location: (%s,%s)', ip.location.latitude, ip.location.longitude))
    db.logDebug(util.format('metro_code: %s', ip.location.metro_code))
    if (ip.postal && ip.postal.code) {
      db.logDebug(util.format('postalcode: %s', ip.postal.code))
    }

    if (ip.subdivisions && ip.subdivisions.length > 0) {
      // db.logDebug(ip.subdivisions)
      db.logDebug(util.format('subdivisions: %s (full=%s)', ip.subdivisions[0].iso_code, ip.subdivisions[0].names.en))
    }
  }
}

// lookup.get('1.1.1.1');
// console.log(ipLookup.get('66.6.44.4'));
// printIPInfo(ipLookup.get('66.6.44.4')) // NY City
// printIPInfo(ipLookup.get('1.1.1.1')) // Research, Australia
// printIPInfo(ipLookup.get('87.98.231.40')) // North Korea -> Spain?
// console.log(ipLookup.get('87.98.231.40'))
// console.log(ipLookup.get('98.138.252.38'))
// printIPInfo(ipLookup.get('bad-ip')) // bad-ip
*/

// https://mochajs.org/
describe('Validate Test IPs', function () {
  describe('Are Located in MaxMind DB', function () {
    it('test ips should never be null', function (done) {
      var err = null
      _.each(mySessions.ipsRandomPublic, function (value) {
        if (!mySessions.getIPLookup(value)) {
          err = new Error(util.format('not found in MaxMind db: %s', value))
          return false
        }
      })
      done(err)
    })
  })

  describe('Are correctly converted', function () {
    it('should all become IP objects', function (done) {
      var err = null
      _.each(mySessions.ipsRandomPublic, function (value) {
        var ipo = mySessions.getIPObject(mySessions.getIPLookup(value))
        if (!ipo.isFound) {
          err = new Error(util.format('mySessions.getIPObject could not find %s', value))
          return false
        }
      })
      done(err)
    })

    // it('should....', function (done) {
    // })
  })
})
