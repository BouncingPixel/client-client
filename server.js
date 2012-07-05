/*
 * server.js:
 *
 * (C) 2012 Bouncing Pixel 
 *
 */

(function () {
  "use strict";

  var express = require('express');
  var consolidate = require('consolidate');
  var async = require('async');
  var Logger = require('bunyan');
  var sio = require("socket.io");
  var Rackspace = require('./Rackspace').Rackspace;
  var Users = require('./Users').Users;
  var Projects = require('./Projects').Projects;

  var configuration;
  var cc;
  var http;
  var io;
  var mongo;
  var rackspace;
  var users;
  var projects;

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

  var startRackspace = function( callback ) {
    log.info( "RACKSPACE: STARTING" );
    rackspace = new Rackspace( configuration.rackInfo );
    log.info( "RACKSPACE: SUCCESS");
    callback();
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

  // set up the projects manager

  var startProjects = function( callback ) {
    log.info( "PROJECTS: STARTING" );
    projects = new Projects( {
      mongo:mongo,
      rackspace:rackspace,
      io:io
    });
    log.info( "PROJECTS: SUCCESS" );
    callback();
  };

  // set up socket.io

  var startSocketIO = function( callback ) {
    log.info( "IO: STARTING" );
    try {
      io = sio.listen( http ).set("log level", 1);
    }
    catch( error ) {
      return callback( error );
    }
    log.info( "IO: SUCCESS" );
    callback();
  };

  // set up express configuration

  var startExpressConfiguration = function( callback ) {
    log.info( "EXPRESS: STARTING" );
    try {
      cc = express();
      http = require("http").createServer(cc);
      cc.engine('dust', consolidate.dust );
      cc.configure( function() {
        cc.set( 'view engine', 'dust' );
        cc.use( express.cookieParser( "rawr" ) );
        cc.use( express.session( { cookie: { maxAge: 3600000 } } ) );
        cc.use( express.static( __dirname + '/static' ) );
        cc.use( express.json() );
        cc.use( express.urlencoded() );
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

    cc.all( '*', function( req, res, next ) {
      users.authenticate( req, res, next );
    });

    cc.get( '/', function( req, res, next ) {
      var _users,
          _projects,
          maybeEnd = function () {
            if(typeof _users !== "undefined" && typeof _projects !== "undefined") {
              var auth = req.session.type==="admin";
              var perm = auth||req.session.type==="employee";
              var locals = { title:'dashboard',
                             name:req.session.name,
                             auth:auth,
                             perm:perm,
                             users:_users || [],
                             projects:_projects || [] };
              res.render( 'dashboard', locals );
            }
          };
      async.parallel([
        function () {
          users.getAllUsers(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
            } else {
              _users = array;
              maybeEnd();
            }
          });
        }, function () {
          projects.getAllProjects(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
            } else {
              _projects = array;
              maybeEnd();
            }
          });
        }], function (err) {
          if(err) {
            console.log(err);
            res.send(500);
          }
        });
    });

    cc.get( '/dashboard', function( req, res, next ) {
      var _users,
          _projects,
          maybeEnd = function () {
            if(typeof _users !== "undefined" && typeof _projects !== "undefined") {
              var auth = req.session.type==="admin";
              var perm = auth||req.session.type==="employee";
              var locals = { title:'dashboard',
                             name:req.session.name,
                             auth:auth,
                             perm:perm,
                             users:_users || [],
                             projects:_projects || [] };
              res.render( 'dashboard', locals );
            }
          };
      async.parallel([
        function () {
          users.getAllUsers(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
            } else {
              _users = array;
              maybeEnd();
            }
          });
        }, function () {
          projects.getAllProjects(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
            } else {
              _projects = array;
              maybeEnd();
            }
          });
        }], function (err) {
          if(err) {
            console.log(err);
            res.send(500);
          }
        });
    });

    cc.post( '/addUser', function( req, res, next ) {
      users.addUser( req, res, next );
    });

    cc.post( '/addProject', function( req, res, next ) {
      projects.addProject( req, res, next );
    });

    cc.get( '/projects/:uri', function( req, res, next ) {
      var clients,
          project,
          files,
          maybeEnd = function () {
            if(typeof clients !== "undefined" && typeof project !== "undefined" && typeof files !== "undefined") {
              var auth = req.session.type==="admin";
              var perm = auth||req.session.type==="employee";
              var bcrypt = require( 'bcrypt' );
              var salt = bcrypt.genSaltSync(10);
              var hash = bcrypt.hashSync(project[0].container||"", salt);
              clients = clients.filter( function( val ) {
                return project[0].users.indexOf(val.name)<0;
              });
              var locals = { project: { name: project[0].name,
                                        users: project[0].users || [],
                                        uri: project[0].uri,
                                        sharingEnabled: project[0].sharingEnabled,
                                        container: project[0].container,
                                        hash: hash
                                      },
                             name:req.session.name,
                             auth:auth,
                             perm:perm,
                             clients:clients,
                             files:files };
              res.render( 'project', locals );
            }
          };
      async.parallel([
        function () {
          users.getAllClients( function( err, array ) {
            if(err) {
              console.log(err);
              return res.send(500);
            }
            clients = array;
            maybeEnd();
          });
        }, function () {
          projects.find( req.params.uri, function( err, obj ) {
            if(err) {
              console.log(err);
              return res.send(500);
            }
            project = obj;
            projects.getFiles( project[0], function( err, array ) {
              if(err) {
                console.log(err);
                return res.send(500);
              }
              files = array;
              maybeEnd();
            });
          });
        }], function (err) {
          if(err) {
            console.log(err);
            return res.send(500);
          }
        });
    });

    cc.post( '/projects/:uri/addUser', function( req, res, next ) {
      projects.addUser( req, res, next );
    });

    cc.post( '/projects/:uri/removeUser', function( req, res, next ) {
      projects.removeUser( req, res, next );
    });

    cc.post( '/projects/:uri/enableSharing', function( req, res, next ) {
      projects.enableSharing( req, res, next );
    });

    cc.post( '/projects/:uri/upload', function( req, res, next ) {
      projects.uploadFile( req, res, next );
    });

    cc.get( '/projects/:uri/downloads/:file', function( req, res, next ) {
      projects.streamFile( req, res, next );
    });

    cc.get( '/projects/:uri/remove/:file', function( req, res, next ) {
      projects.removeFile( req, res, next );
    });

    cc.post( '/projects/:uri/update/:file', function( req, res, next ) {
      projects.updateFile( req, res, next );
    });
    
    log.info( "ROUTES: SUCCESS" );
    callback();
  };

  // start the express server listening

  var startExpressListen = function( callback ) {
    log.info( "LISTENING: STARTING" );
    http.listen( configuration.port );
    log.info( "LISTENING: SUCCESS" );
    callback();
  };

  // go through the startup sequence in the proper order

  async.series( [
                  startConfiguration,
                  startDatabase,
                  startRackspace,
                  startUsers,
                  startExpressConfiguration,
                  startSocketIO,
                  startProjects,
                  startExpressRoutes,
                  startExpressListen
    ],
    function( error, results ) {
      if( error ) { log.error( { err:error } ); throw error; }
      log.info( "STARTUP: SUCCESS" );
    }
  );

}());
