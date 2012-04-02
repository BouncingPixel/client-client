/*
 * server.js:
 *
 * (C) 2012 Bouncing Pixel 
 *
 */

(function () {
  "use strict";

  var express = require('./express');
  var consolidate = require('./consolidate');
  var async = require('async');
  var Logger = require('bunyan');
  var Users = require('./Users').Users;

  var configuration;
  var cc;
  var mongo;
  var users;

  var log = new Logger( {
    name:'client-client',
    serializers: {
      err: Logger.stdSerializers.err
    } 
  });

  log.info( "STARTUP: STARTING");

  // load configuration

  var startConfiguration = function( callback ) {
    log.info( "CONFIGURATION: STARTING" );
    if( !require('path').existsSync( './conf/baseConfiguration.js' ) ) {
      return callback( new Error( 'no configuration found' ) );
    }
    configuration = require('./conf/baseConfiguration');
    log.info( "CONFIGURATION: SUCCESS" );
    callback();
  };

  // connect to the database

  var startDatabase = function( callback ) {
    log.info( "DATABASE: STARTING" );
    mongo = require('./Mongo').createMongo( configuration.dbInfo );

    mongo.connect( function( error ) {
      if( !error ) { log.info( "DATABASE: SUCCESS" ); }
      callback( error );
    });
  };

  // set up the users manager

  var startUsers = function( callback ) {
    log.info( "USERS: STARTING" );
    users = new Users( {
      mongo:mongo
    });
    log.info( "USERS: SUCCESS" );
    callback();
  };

  // set up express configuration

  var startExpressConfiguration = function( callback ) {
    log.info( "EXPRESS: STARTING" );
    try {
      cc = express();
      cc.engine('dust', consolidate.dust );
      cc.configure( function() {
        cc.set( 'view engine', 'dust' );
        cc.use( express.cookieParser( "rawr" ) );
        cc.use( express.session( { cookie: { maxAge: 60000 } } ) );
        cc.use( express.static( __dirname + '/static' ) );
        cc.use( express.bodyParser() );
        cc.use( cc.router );
      });
    }
    catch( error ) {
      return callback( error );
    }
    log.info( "EXPRESS: SUCCESS" );
    callback();
  };

  // set up routes

  var startExpressRoutes = function( callback ) {
    log.info( "ROUTES: STARTING" );

    cc.get( '/favicon.ico', function( req, res, next ) {
      return res.send(404, '');
    });

    cc.get( '/authenticate', function( req, res, next ) {
      var locals = { title:configuration.loginTitle,
                     heroTitle:configuration.heroTitle,
                     heroDescription:configuration.heroDescription,
                     invalid:req.session.invalid };
      res.render( 'index', locals );
    });

    cc.post( '/checkPassword', function( req, res, next ) {
      users.checkPassword( req, res, next );
    });

    cc.get( '*', function( req, res, next ) {
      users.authenticate( req, res, next );
    });

    cc.get( '/', function( req, res, next ) {
      client.dashboard( req, res, next );
    });

    cc.get( '/dashboard', function( req, res, next ) {
      //client.dashboard( req, res, next );
      var locals = { title:'dashboard',
                     name:req.session.name };
      res.render( 'dashboard', locals );
    });

    log.info( "ROUTES: SUCCESS" );
    callback();
  };

  // start the express server listening

  var startExpressListen = function( callback ) {
    log.info( "LISTENING: STARTING" );
    cc.listen( configuration.port );
    log.info( "LISTENING: SUCCESS" );
    callback();
  };

  // go through the startup sequence in the proper order

  async.series( [
                  startConfiguration,
                  startDatabase,
                  startExpressConfiguration,
                  startUsers,
                  startExpressRoutes,
                  startExpressListen
    ],
    function( error, results ) {
      if( error ) { log.error( { err:error } ); throw error; }
      log.info( "STARTUP: SUCCESS" );
    }
  );

}());
