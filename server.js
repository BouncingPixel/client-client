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
  var MongoStore = require('connect-mongodb');
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
        cc.use( express.session({
          secret: "rawr",
          store: new MongoStore({
            db: mongo.getDB()
          })
        }));
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

    var getLocals = function (asyncMethods, options, callback) {
      var locals = {};

      var methods = {
        getAllUsers: function (callback) {
          users.getAllUsers(function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.allUsers = array;
            callback();
          });
        },
        getAllClients: function (callback) {
          users.getAllClients(function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.allClients = array;
            callback();
          });
        },
        getUser: function (userId, callback) {
          users.find(userId, function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.user = array[0];
            callback();
          });
        },
        getProject: function (projectUri, callback) {
          projects.find(projectUri, function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.project = array[0];
            callback();
          });
        },
        getAllProjects: function (callback) {
          projects.getAllProjects(function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.allProjects = array;
            callback();
          });
        },
        getUserProjects: function (projectUser, callback) {
          projects.getProjectsForUser(projectUser, function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.userProjects = array;
            callback();
          });
        },
        getProjectFiles: function (fileProject, callback) {
          projects.getFiles(fileProject, function (err, array) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.projectFiles = array;
            callback();
          });
        },
        getAllHerokuApps: function (callback) {
          herokuClient.listApps(function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.allHerokuApps = JSON.parse(body);
            callback();
          });
        },
        getHerokuApp: function (herokuApp, callback) {
          herokuClient.getInfo(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuApp = JSON.parse(body);
            callback();
          });
        },
        getHerokuAppCollaborators: function (herokuApp, callback) {
          herokuClient.listCollaborators(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppCollaborators = JSON.parse(body);
            callback();
          });
        },
        getHerokuAppDomains: function (herokuApp, callback) {
          herokuClient.listDomains(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppDomains = JSON.parse(body);
            callback();
          });
        },
        getHerokuAppLogs: function (herokuApp, callback) {
          herokuClient.getLogs(herokuApp, 100, null, null, null, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppLogs = body;
            callback();
          });
        },
        getHerokuAppProcesses: function (herokuApp, callback) {
          herokuClient.listProcesses(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppProcesses = JSON.parse(body);
            callback();
          });
        },
        getHerokuAppReleases: function (herokuApp, callback) {
          herokuClient.listReleases(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppReleases = JSON.parse(body);
            callback();
          });
        },
        getHerokuAppAddons: function (herokuApp, callback) {
          herokuClient.listAddonsInstalled(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppAddons = JSON.parse(body);
            callback();
          });
        },
        getHerokuAppConfigVars: function (herokuApp, callback) {
          herokuClient.listConfigVars(herokuApp, function (err, body) {
            if(err) {
              console.log(err);
              return callback(err);
            }
            locals.herokuAppConfigVars = JSON.parse(body);
            callback();
          });
        }
      };
      var walk = function (array) {
        var asyncMethod = array.shift();
        if(typeof async[asyncMethod] !== "function") {
          throw new Error("Invalid method "+asyncMethod);
        }
        switch(asyncMethod) {
          case "parallel":
          case "series":
            var funcs = [];
            var next;
            while(array.length) {
              next = array.shift();
              if(methods[next]) {
                funcs.push(methods[next]);
              } else if(Array.isArray(next)) {
                funcs.push(walk(next));
              } else {
                (function () {
                  var varChain = next.split(":");
                  var method = varChain.shift();
                  varChain = varChain[0].split(".");
                  funcs.push(function (callback) {
                    var fromArg;
                    switch(varChain.shift()) {
                      case "locals":
                        fromArg = locals;
                        break;
                      case "options":
                        fromArg = options;
                        break;
                    }
                    while(varChain.length) {
                      fromArg = fromArg[varChain.shift()];
                    }
                    methods[method](fromArg, callback);
                  });
                })();
              }
            }
            return function (callback) {
              async[asyncMethod](funcs, function (err) {
                if(err) {
                  console.log(err);
                  return callback(err);
                }
                callback();
              });
            };
          case "map":
            var varChain = array.shift().split(".");
            var iterator = array.shift();
            var option;
            if(methods[iterator]) {
              option = iterator.substr(3,1).toLowerCase()+iterator.substr(4);
            } else {
              throw new Error("Invalid method "+iterator);
            }
            return function (callback) {
              var fromArray;
              switch(varChain.shift()) {
                case "locals":
                  fromArray = locals;
                  break;
                case "options":
                  fromArray = options;
                  break;
              }
              while(varChain.length) {
                fromArray = fromArray[varChain.shift()];
              }
              async[asyncMethod](fromArray, function (from, callback) {
                methods[iterator](from, function (err) {
                  if(err) {
                    console.log(err);
                    return callback(err);
                  }
                  return callback(null, locals[option]);
                });
              }, function (err, array) {
                if(err) {
                  console.log(err);
                  return callback(err);
                }
                locals[option] = array;
                callback();
              });
            };
          default:
            throw new Error("Unsupported method "+asyncMethod);
        }
      };
      try {
        (walk(asyncMethods))(function (err) {
          if(err) {
            console.log(err);
            return callback(err);
          }
          callback(null, locals);
        });
      } catch(err) {
        console.log(err);
        return callback(err);
      }
    };

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

    cc.get( '/logout', function( req, res, next ) {
      req.session.regenerate(function (err) {
        res.redirect( '/authenticate' );
      });
    });

    cc.get( '/', function( req, res, next ) {
      var asyncMethods = [
        "parallel",
        "getAllUsers",
        "getAllProjects",
        "getUserProjects:options.projectUser"
      ];
      var options = {
        "projectUser":req.session.name
      };
      var callback = function (err, locals) {
        if(err) {
          console.log(err);
          return res.send(500);
        }
        var auth = req.session.type==="admin";
        var perm = auth||req.session.type==="employee";
        locals = { 
          title:'dashboard',
          name:req.session.name,
          auth:auth,
          perm:perm,
          users:locals.allUsers || [],
          projects:locals.allProjects || [],
          clientOf:locals.userProjects || []
        };
        res.render( 'dashboard', locals );
      };
      getLocals(asyncMethods, options, callback);
    });

    cc.get( '/dashboard', function( req, res, next ) {
      var asyncMethods = [
        "parallel",
        "getAllUsers",
        "getAllProjects",
        "getUserProjects:options.projectUser"
      ];
      var options = {
        "projectUser":req.session.name
      };
      var callback = function (err, locals) {
        if(err) {
          console.log(err);
          return res.send(500);
        }
        var auth = req.session.type==="admin";
        var perm = auth||req.session.type==="employee";
        locals = { 
          title:'dashboard',
          name:req.session.name,
          auth:auth,
          perm:perm,
          users:locals.allUsers || [],
          projects:locals.allProjects || [],
          clientOf:locals.userProjects || []
        };
        res.render( 'dashboard', locals );
      };
      getLocals(asyncMethods, options, callback);
    });

    cc.post( '/addUser', function( req, res, next ) {
      users.addUser( req, res, next );
    });

    cc.post( '/addProject', function( req, res, next ) {
      projects.addProject( req, res, next );
    });

    cc.get( '/projects/:uri', function( req, res, next ) {
      var asyncMethods = [
        "parallel",
        "getAllClients",
        "getAllUsers",
        "getAllProjects",
        "getUserProjects:options.projectUser",
        [
          "series",
          "getProject:options.projectUri",
          [
            "parallel",
            [
              "map",
              "locals.project.herokuApps",
              "getHerokuAppProcesses"
            ],
            "getProjectFiles:locals.project"
          ]
        ],
        "getAllHerokuApps"
      ];
      var options = {
        "projectUri":req.params.uri,
        "projectUser":req.session.name
      };
      var callback = function (err, locals) {
        if(err) {
          console.log(err);
          return res.send(500);
        }
        var auth = req.session.type==="admin";
        var perm = auth||req.session.type==="employee";
        var isClient = locals.project.users.indexOf(req.session.name)>=0;
        if(!auth&&!perm&&!isClient) {
          return res.send(401);
        }
        var bcrypt = require( 'bcrypt' );
        var salt = bcrypt.genSaltSync(10);
        var hash = bcrypt.hashSync(locals.project.container||"", salt);
        var clients = locals.allClients.filter( function( val ) {
          return locals.project.users.indexOf(val.name)<0;
        });
        locals.project.herokuApps = locals.project.herokuApps.map(function (appName, index) {
          var app = {
            name:appName
          };
          app.processes = locals.herokuAppProcesses[index];
          switch(app.processes.length) {
            case 0:
              app.status = "0 processes";
              break;
            case 1:
              app.status = app.processes[0].pretty_state;
              break;
            default:
              var states = {};
              app.processes.forEach(function (process) {
                if(typeof states[process.state] === "undefined") {
                  states[process.state] = 1;
                } else {
                  states[process.state]++;
                }
              });
              app.status = Object.getOwnPropertyNames(states).map(function (state) {
                return state+": "+states[state];
              }).sort().join(", ");
              break;
          }
          return app;
        });
        var herokuApps = locals.allHerokuApps.filter( function( val ) {
          return locals.project.herokuApps.map(function (app) {
            return app.name;
          }).indexOf(val.name)<0;
        });
        locals = { 
          project: { 
            name: locals.project.name,
            users: locals.project.users || [],
            uri: locals.project.uri,
            sharingEnabled: locals.project.sharingEnabled,
            container: locals.project.container,
            hash: hash,
            herokuApps: locals.project.herokuApps,
            herokuEnabled: locals.project.herokuEnabled
          },
          name:req.session.name,
          auth:auth,
          perm:perm,
          isClient:isClient,
          users: locals.allUsers,
          projects: locals.allProjects,
          clientOf: locals.userProjects,
          clients:clients,
          files:locals.projectFiles,
          herokuApps:herokuApps
        };
        res.render( 'project', locals );
      };
      getLocals(asyncMethods, options, callback);
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

    cc.post( '/projects/:uri/enableHeroku', function( req, res, next ) {
      projects.enableHeroku( req, res, next );
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
      var asyncMethods = [
        "parallel",
        "getAllUsers",
        "getAllProjects",
        "getUserProjects:options.projectUser",
        "getHerokuApp:options.herokuApp",
        "getHerokuAppLogs:options.herokuApp",
        "getHerokuAppDomains:options.herokuApp",
        "getHerokuAppProcesses:options.herokuApp"
      ];
      var options = {
        projectUser:req.session.name,
        herokuApp:req.params.name
      };
    	var callback = function (err, locals) {
        if(err) {
          console.log(err);
          return res.send(500);
        }
        var domains = locals.herokuAppDomains;
        var processes = locals.herokuAppProcesses;
				var info = locals.herokuApp;
				var auth = req.session.type==="admin";
				var perm = auth||req.session.type==="employee";
				locals = {
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
          domains: domains.map(function (domain) {
            return {
              properties: Object.getOwnPropertyNames(domain).filter(function (prop) {
                return !!domain[prop]&&prop!=="domain";
              }).map(function (prop) {
                return {
                  name:prop,
                  value:domain[prop]
                };
              }),
              name: domain["domain"]
            };
          }),
          processes: processes.map(function (process) {
            return {
              properties: Object.getOwnPropertyNames(process).filter(function (prop) {
                return (!!process[prop]||typeof process[prop]==="boolean")&&prop!=="process";
              }).map(function (prop) {
                return {
                  name:prop,
                  value:process[prop].toString()
                };
              }),
              name: process["process"]
            };
          }),
					logplex: locals.herokuAppLogs,
					name: req.session.name,
					auth: auth,
					perm: perm,
          users: locals.allUsers,
          projects: locals.allProjects,
          clientOf: locals.userProjects
				};
				res.render( 'herokuStatus', locals );
			};
			getLocals(asyncMethods, options, callback);
    });
    
    cc.get( '/herokuApps/:name/logs', function ( req, res, next ) {
    	var uri = req.param( 'log' );
    	if(typeof uri==="string") {
    		request({method:"GET", uri:uri}).pipe(res);
    	} else {
    		res.send(500);
    	}
    });

    cc.post( '/herokuApps/:name/ps/restart', function ( req, res, next ) {
      var ps = req.param( 'ps' );
      if(typeof ps==="string") {
        herokuClient.restart(req.params.name, ps, null, function (err, body) {
          if(err) {
            console.log(err);
            res.send(500);
          } else {
            res.send(200);
          }
        });
      } else {
      	res.send(500);
      }
    });

    cc.post( '/herokuApps/:name/ps/stop', function ( req, res, next ) {
      var ps = req.param( 'ps' );
      if(typeof ps==="string") {
        herokuClient.stop(req.params.name, ps, null, function (err, body) {
          if(err) {
            console.log(err);
            res.send(500);
          } else {
            res.send(200);
          }
        });
      } else {
      	res.send(500);
      }
    });

    cc.post( '/users/:uri/update', function( req, res, next ) {
      users.setType(req, res, next);
    });

    cc.get( '/users/:uri', function( req, res, next ) {
      var asyncMethods = [
        "parallel",
        "getAllUsers",
        "getAllProjects",
        [
          "series",
          "getUser:options.userId",
          "getUserProjects:locals.user.name"
        ]
      ];
      var options = {
        userId:req.params.uri
      };
      var callback = function (err, locals) {
        if(err) {
          console.log(err);
          return res.send(500);
        }
        var projects = locals.userProjects.map(function (project) {
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
        if(!perm) {
          return res.send(401);
        }
        if(locals.user.type==="admin") {
          locals.user.auth = true;
        }
        if(locals.user.auth||locals.user.type==="employee") {
          locals.user.perm = true;
        }
        locals = {
          name: req.session.name,
          auth: auth,
          perm: perm,
          user: locals.user||{},
          userProjects: projects||[],
          projects: locals.allProjects||[],
          users: locals.allUsers||[]
        };
        res.render( 'userStats', locals );
      };
      getLocals(asyncMethods, options, callback);
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
