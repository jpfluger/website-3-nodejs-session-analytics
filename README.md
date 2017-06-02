# Website 3: NodeJS Session Analytics

A website primer for Node Express sessions using [Redis](https://redis.io/) for in-memory storage and [Postgres](https://www.postgresql.org/) for disk storage. This site is built upon [Website 2: NodeJS Marko Templates](https://github.com/jpfluger/website-2-nodejs-marko-templates) which uses Marko (v4+), Twitter Bootstrap (v3.3), Bootstrap-Dialog, JQuery, lodash, numeral and moment.

This website template includes support for (simple) page-tracking and user session management.

It also uses a [docker-compose](https://docs.docker.com/compose/) to assist in the creation and deletion of Redis/Postgres. 

> Note: We purposefully retain comments in the source to assist users.

## Install `docker-compose`

Follow the directions to install [docker](https://docs.docker.com/engine/installation/) and [docker-compose](https://docs.docker.com/compose/)

## Redis and Postgres

Run Redis and Postgres in the background.

```bash
$ docker-compose -p web3 -f docker-dev.yml up -d
```

Destroy Redis and Postgres. This will stop the containers if they are already running.

```bash
$ docker-compose -p web3 -f docker-dev.yml down
```

Stop Redis and Postgres but do not destroy them.

```bash
$ docker-compose -p web3 -f docker-dev.yml stop
```

## Install `node`

Download [NodeJS](https://nodejs.org/en/) and install the version for your operating system. 

## Install `npm` and `bower` modules

We include a script, `install.sh` that initializes:

* local npm modules in directory `node_modules`
* local bower modules in directory `bower_components`

Then it copies only the required files from `bower_components/` into `public/_third/`, a directory we use to serve public web pages.

Run installation:

```bash
./install.sh
```

## Run

We've switched to using npm, so we can easily set modes for `production` or `development`.

For production mode, run

```bash
$ npm run start
```

For development (debug) mode, run

```bash
$ npm run debug
```

> Note: Type Ctrl-C to quit the server.

Open the client web browser to url [http://localhost:8080](http://localhost:8080).

## Db

When the server starts, the server checks for a valid db connection. If the connection is valid and the db does not exist, then the server will initialize the database using the sql schema found in `db/schema.sql`.

## Sessions Stats

This demo covers these parts to server-side website statistics tracking:

1. Global statistics
   * page tracking
   * [parsing](https://github.com/faisalman/ua-parser-js) user-agent strings
   * ip address plus OPTIONAL locale matching (eg country, city, state) using [node-maxmind](https://github.com/runk/node-maxmind)
2. Individual session connection statistics (this is about the connection and NOT user login)
   * page tracking
   * ip address with location information is passed to the individual session and can be used for decision-making
   * the parsed user-agent string is passed to the individual session and can be used for decision-making

Regarding `ip` addresses resolution to locale. This demo optionally uses [node-maxmind](https://github.com/runk/node-maxmind) and separately dowwnloaded databases from [MaxMind](http://dev.maxmind.com/geoip/geoip2/geolite2/). Depending on your needs, you may want to forgo ip lookups in real-time and instead have a different app analyze ip data later. We like [node-maxmind](https://github.com/runk/node-maxmind) because it includes caching ip-lookup results and watches for updates to the local MaxMind database.

Consider a MaxMind [subscription](https://www.maxmind.com/en/geoip2-city) for more up-to-date ip databases for cities. This FAQ discusses MaxMind's [accuracy](https://dev.maxmind.com/faq/how-accurate-are-the-geoip-databases/) 

The `install.sh` script handles automatic downloads of the MaxMind Db into a maxmind folder. `.gitignore` is set to ignore any files in the maxmind folder.

### Server-side tracking vs client-side tracking

One benefit of client-side tracking is that it allows to capture the time and geometric areas that a user spends on a page. This ties-in with page tracking analytics and ad-view software. This demo does not include this type of tracking. For assistance in developing your own client-side analystics, examine [node-analytics](https://github.com/andrao/node-analytics)

In this demo, statistic tracking is performed server-side and not client-side, like [Google Analytics](https://www.google.com/analytics/#?modal_active=none). To integrate your site with Google, consider using the [universal-analytics](https://github.com/peaksandpies/universal-analytics) project.

## [MIT Licensed](LICENSE)
