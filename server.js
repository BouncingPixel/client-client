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
  var cc;

  console.log( "=> CLIENT CLIENT: STARTING");
  console.log( "==> CONFIGURATION: STARTING" );
  if( !require('path').existsSync( './conf/baseConfiguration.js' ) ) {
    return console.log( "Error! No configuration file found.");
  }
  configuration = require('./conf/baseConfiguration');
  console.log( "==> CONFIGURATION: SUCCESS" );

  // connect to the database
  console.log( "==> DATABASE: STARTING" );
  console.log( "==> DATABASE: SUCCESS" );

  // set up express configuration
  console.log( "==> EXPRESS: STARTING" );
  cc = express();
  cc.engine('dust', consolidate.dust );
  cc.configure( function() {
    cc.set( 'view engine', 'dust' );
    cc.use( express.static( __dirname + '/static' ) );
    cc.use( express.bodyParser() );
    cc.use( cc.router );
  });
  console.log( "==> EXPRESS: SUCCESS" );

  // set up routes
  console.log( "==> ROUTES: STARTING" );
  cc.get( '/', function( req, res ) {

    var locals = { title:'Initial title',
                   body:'Initial body' };
    res.render('index', locals );
  });
  console.log( "==> ROUTES: SUCCESS" );

  // start the express server listening
  console.log( "==> LISTENING: STARTING" );
  cc.listen( 8080 );
  console.log( "==> LISTENING: SUCCESS" );

  console.log( "=> CLIENT CLIENT: SUCCESS" );

}());
