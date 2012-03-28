/*
 * server.js:
 *
 * (C) 2012 Bouncing Pixel 
 *
 */

(function () {
  "use strict";

  // load configuration

  var configuration;
  var express = require('./express');
  var consolidate = require('./consolidate');
  var Logger = require('bunyan');
  var log = new Logger( {name:'client-client'});
  var cc;

  log.info( "STARTUP: STARTING");
  log.info( "CONFIGURATION: STARTING" );
  if( !require('path').existsSync( './conf/baseConfiguration.js' ) ) {
    return log.error( "No configuration file found.");
  }
  configuration = require('./conf/baseConfiguration');
  log.info( "CONFIGURATION: SUCCESS" );

  // connect to the database
  log.info( "DATABASE: STARTING" );
  log.info( "DATABASE: SUCCESS" );

  // set up express configuration
  log.info( "EXPRESS: STARTING" );
  cc = express();
  cc.engine('dust', consolidate.dust );
  cc.configure( function() {
    cc.set( 'view engine', 'dust' );
    cc.use( express.static( __dirname + '/static' ) );
    cc.use( express.bodyParser() );
    cc.use( cc.router );
  });
  log.info( "EXPRESS: SUCCESS" );

  // set up routes
  log.info( "ROUTES: STARTING" );
  cc.get( '/', function( req, res ) {

    var locals = { title:configuration.loginTitle,
                   heroTitle:configuration.heroTitle,
                   heroDescription:configuration.heroDescription };
    res.render('index', locals );
  });
  log.info( "ROUTES: SUCCESS" );

  // start the express server listening
  log.info( "LISTENING: STARTING" );
  cc.listen( configuration.port );
  log.info( "LISTENING: SUCCESS" );

  log.info( "STARTUP: SUCCESS" );

}());
