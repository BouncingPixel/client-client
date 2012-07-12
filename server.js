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
  var request = require('request');
  var Logger = require('bunyan');
  var sio = require("socket.io");
  var Rackspace = require('./Rackspace').Rackspace;
  var HerokuClient = require('./HerokuClient').HerokuClient;
  var Users = require('./Users').Users;
  var Projects = require('./Projects').Projects;

  var configuration;
  var cc;
  var http;
  var io;
  var mongo;
  var rackspace;
  var herokuClient;
  var users;
  var projects;

  var log = new Logger( {
    name:'client-client',
    serializers: {
      err: Logger.stdSerializers.err
    } 
  });

  var sanitize = function ( str ) {
    if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' );
    return "";
  };

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

  var startHerokuClient = function( callback ) {
    log.info( "HEROKUCLIENT: STARTING" );
    herokuClient = new HerokuClient( configuration.herokuInfo );
    log.info( "HEROKUCLIENT: SUCCESS" );
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
        function (callback) {
          users.getAllUsers(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
            } else {
              _users = array;
              callback();
            }
          });
        }, function (callback) {
          projects.getAllProjects(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
              callback(err);
            } else {
              _projects = array;
              callback();
            }
          });
        }], function (err) {
          if(err) {
            console.log(err);
          } else {
          	maybeEnd();
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
            } else {
            	res.send(500);
            }
          };
      async.parallel([
        function (callback) {
          users.getAllUsers(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
              callback(err);
            } else {
              _users = array;
              callback();
            }
          });
        }, function (callback) {
          projects.getAllProjects(function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
              callback(err);
            } else {
              _projects = array;
              callback();
            }
          });
        }], function (err) {
          if(err) {
            console.log(err);
          } else {
          	maybeEnd();
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
          herokuApps,
          maybeEnd = function () {
            if(typeof clients !== "undefined" && typeof project !== "undefined" && typeof files !== "undefined" && typeof herokuApps !== "undefined") {
              var auth = req.session.type==="admin";
              var perm = auth||req.session.type==="employee";
              var bcrypt = require( 'bcrypt' );
              var salt = bcrypt.genSaltSync(10);
              var hash = bcrypt.hashSync(project[0].container||"", salt);
              clients = clients.filter( function( val ) {
                return project[0].users.indexOf(val.name)<0;
              });
              herokuApps = herokuApps.filter( function( val ) {
                return project[0].herokuApps.indexOf(val.name)<0;
              });
              var locals = { project: { name: project[0].name,
                                        users: project[0].users || [],
                                        uri: project[0].uri,
                                        sharingEnabled: project[0].sharingEnabled,
                                        container: project[0].container,
                                        hash: hash,
                                        herokuApps: project[0].herokuApps
                                      },
                             name:req.session.name,
                             auth:auth,
                             perm:perm,
                             clients:clients,
                             files:files,
                             herokuApps:herokuApps };
              res.render( 'project', locals );
            }
          };
      async.parallel([
        function (callback) {
          users.getAllClients( function( err, array ) {
            if(err) {
              console.log(err);
              res.send(500);
              return callback(err);
            }
            clients = array;
            callback();
          });
        }, function (callback) {
          projects.find( req.params.uri, function( err, obj ) {
            if(err) {
              console.log(err);
              res.send(500);
              return callback(err);
            }
            project = obj;
            projects.getFiles( project[0], function( err, array ) {
              if(err) {
                console.log(err);
                res.send(500);
                return callback(err);
              }
              files = array;
              callback();
            });
          });
        }, function (callback) {
          herokuClient.listApps(function (err, json) {
            if(err) {
              console.log(err);
              res.send(500);
              return callback(err);
            }
            try {
              herokuApps = JSON.parse(json);
            } catch(err) {
              console.log(err);
              res.send(500);
              return callback(err);
            }
            callback();
          });
        }], function (err) {
          if(err) {
            console.log(err);
          } else {
          	maybeEnd();
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

    cc.post( '/projects/:uri/addHerokuApp', function( req, res, next ) {
      projects.addHerokuApp( req, res, next );
    });
    
    cc.get( '/herokuApps/:name', function( req, res, next ) {
    	var json,
    			logplex,
    			complete = function (err) {
    				try {
							var info = JSON.parse(json);
							var auth = req.session.type==="admin";
							var perm = auth||req.session.type==="employee";
							var locals = {
								list: Object.getOwnPropertyNames(info).filter(function (prop) {
									switch(typeof info[prop]) {
										case "undefined":
											return false;
										case "object":
										case "string":
											return !!info[prop];
										default:
											return true;
									}
								}).map(function (prop) {
									var val;
									if(prop === "domain_name") {
										val = info[prop].domain;
									} else {
										val = info[prop];
									}
									return {
										name:prop,
										value:val
									};
								}),
								dict: info,
								logplex: logplex,
								name: req.session.name,
								auth: auth,
								perm: perm
							};
							res.render( 'herokuStatus', locals );
						} catch(err) {
							console.log(err);
							return res.send(500);
						}
					};
			async.parallel([function (callback) {
					herokuClient.getInfo( req.params.name, function (err, body) {
						if(err) {
							console.log(err);
							res.send(500);
							return callback(err);
						}
						json = body;
						callback();
					});
				}, function (callback) {
					herokuClient.getLogs( req.params.name, null, null, null, null, function (err, body) {
						if(err) {
							console.log(err);
							res.send(500);
							return callback(err);
						}
						logplex = body;
						callback();
					});
				}], function (err) {
					if(err) {
						console.log(err);
						return;
					} else {
						complete();
					}
			});
    });
    
    cc.post( '/herokuApps/:name', function ( req, res, next ) {
    	var uri = req.param( 'log' );
    	if(typeof uri==="string") {
    		request({method:"GET", uri:uri}).pipe(res);
    	} else {
    		res.send(500);
    	}
    });

    cc.get( '/users/:uri', function( req, res, next ) {
      var user;
      async.series([function (callback) {
        users.find(req.params.uri, function (err, array) {
          if(err) {
            console.log(err);
            res.send(500);
            return callback(err);
          }
          user = array[0];
          callback();
        });
      }, function (callback) {
        projects.getProjectsForUser(user.name, function (err, array) {
          if(err) {
            console.log(err);
            res.send(500);
            return callback(err);
          }
          var projects = array.map(function (project) {
            if(Array.isArray(project.users) && project.users) {
              project.users = project.users.map(function (user) {
                return {
                  name: user,
                  id: sanitize(user).toLowerCase()
                };
              });
            }
            return project;
          });
          var auth = req.session.type==="admin";
          var perm = auth||req.session.type==="employee";
          var locals = {
            name: req.session.name,
            auth: auth,
            perm: perm,
            user: user||{},
            projects: projects||[]
          };
          res.render( 'userStats', locals );
          callback();
        });
      }]);
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
                  startHerokuClient,
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
