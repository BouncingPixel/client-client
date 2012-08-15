var IncomingForm = require('formidable').IncomingForm;
var qs = require('qs');
var BufferedStream = require('./BufferedStream').BufferedStream;

// sockets will be stored according to hash values on project pages

var io;
var sockets = {};

function randInt(from, to) {
  return from+Math.floor(Math.random()*(to-from));
}

function sanitize( str ) {
  if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' ).toLowerCase();
  return "";
}

// returns a directory-like object from an array of files containing paths
Array.prototype.channelize = function () {
  var self = this;
  var root = {
    isDirectory: true,
    path: "",
    name: "",
    files: []
  };
  //formats the files
  var formatFile = function (file, name, dirPath) {
    bytes = file.bytes;
    date = new Date(file.lastModified);
    return {
      name: decodeURIComponent(name),
      filename: encodeURIComponent(name),
      path: dirPath+"/"+decodeURIComponent(name),
      bytes: bytes,
      date: date,
      prettyDate: (date.toDateString().split(" ").slice(1).join(" "))+" "+date.toLocaleTimeString(),
      type: file.contentType,
      size: (function () {
        if(bytes < 1024) {
          return bytes+" B";
        } else if(bytes < 1024*1024) {
          return (bytes/1024).toFixed(1)+" kB";
        } else if(bytes < 1024*1024*1024) {
          return (bytes/(1024*1024)).toFixed(1)+" MB";
        } else if(bytes < 1024*1024*1024*1024) {
          return (bytes/(1024*1024*1024)).toFixed(1)+" GB";
        } else {
          return (bytes/(1024*1024*1024*1024)).toFixed(1)+" TB";
        }
      })()
    };
  };
  //creates the directory
  self.forEach(function (file) {
    var path = "";
    path += decodeURIComponent(file.name);
    path = path.split("/");
    var cwd = root;
    while(path.length) {
      var dir = path.shift();
      var index = -1;
      for(var i=0;i<cwd.files.length;i++) {
        if(cwd.files[i].isDirectory && cwd.files[i].name === dir) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        index = cwd.files.length;
        if(path.length) {
          cwd.files.push({
            isDirectory: true,
            path: cwd.path+"/"+dir,
            name: dir,
            dirname: encodeURIComponent(dir),
            files: []
          });
          cwd = cwd.files[index];
        } else {
          cwd.files.push(formatFile(file, dir, cwd.path)); 
        }
      } else {
        if(path.length) {
          cwd = cwd.files[index];
        } else {
          cwd.files.push(formatFile(file, dir, cwd.path));
        }
      }
    }
  });
  //calculates and sorts the directories
  (function (dir, indent, id) {
    var self = arguments.callee;
    var bytes = 0;
    var date;
    var files = dir.files;
    var i = files.length;
    dir.id = id||"file0";
    indent = indent||15;
    while(i--) {
      if(files[i].isDirectory) {
        var stats = self(files[i], indent+15, dir.id+"_"+i);
        bytes += stats.bytes;
        if(typeof date === "undefined") {
          date = stats.date;
        } else if(date < stats.date) {
          date = stats.date;
        }
      } else {
        files[i].indent = indent;
        bytes += files[i].bytes;
        if(typeof date === "undefined") {
          date = files[i].date;
        } else if(date < files[i].date) {
          date = files[i].date;
        }
      }
    }
    dir.indent = indent-15;
    dir.bytes = bytes;
    dir.date = date||new Date();
    dir.prettyDate = (dir.date.toDateString().split(" ").slice(1).join(" "))+" "+dir.date.toLocaleTimeString();
    dir.size = (function () {
      if(bytes < 1024) {
        return bytes+" B";
      } else if(bytes < 1024*1024) {
        return (bytes/1024).toFixed(1)+" kB";
      } else if(bytes < 1024*1024*1024) {
        return (bytes/(1024*1024)).toFixed(1)+" MB";
      } else if(bytes < 1024*1024*1024*1024) {
        return (bytes/(1024*1024*1024)).toFixed(1)+" GB";
      } else {
        return (bytes/(1024*1024*1024*1024)).toFixed(1)+" TB";
      }
    })();
    return {
      bytes: bytes,
      date: date
    };
  })(root);
  return root;
};

var Projects = exports.Projects = function( spec ) {
  this._mongo = spec.mongo || null;
  this._conf = spec.conf || {};

  this._projects = this._mongo.getCollection( 'projects' );
  this._rackspace = spec.rackspace;
  io = spec.io;
  io.of("/upload").on("connection", function (socket) {
    var hash;
    socket.on("message", function (str) {
      hash = str;
      sockets[hash] = socket;
    });
    socket.on("disconnect", function () {
      if (typeof hash === "string") {
        delete sockets[hash];
      }
    });
  });
};

Projects.prototype.addProject = function( req, res, next ) {
  var self = this;
  var name = req.param( 'name' );
  var parsedName = sanitize( name );
  if(parsedName) {
    self._projects.insert( { name:name, uri:parsedName, users:[], herokuApps:[], nodejitsuApps:[] }, { safe:true }, function( err ) {
      if( err ) { console.log( err.msg ); }
      res.redirect( '/projects/'+parsedName );
    });
  } else {
    res.redirect( '/dashboard' );
  }
};

Projects.prototype.find = function( uri, callback ) {
  var self = this;
  self._projects.find( { uri:uri }, { name:1, users:1, uri:1, sharingEnabled:1, container:1, herokuApps:1, nodejitsuApps:1, herokuEnabled:1, nodejitsuEnabled:1 } ).toArray( callback );
};

Projects.prototype.getAllProjects = function( callback ) {
  var self = this;
  self._projects.find( {}, { name:1, uri:1 } ).toArray( callback );
};

Projects.prototype.getProjectsForUser = function ( username, callback ) {
  var self = this;
  self._projects.find( { users: { '$in': [username] } }, { name:1, users:1, uri:1 } ).toArray( callback );
};

Projects.prototype.addUser = function( req, res, next ) {
  var self = this;
  if(req.param( 'name' )) {
    self.find( req.params.uri, function( err, projects ) {
      if (projects && projects[0] ) {
        self._projects.update( { name:projects[0].name }, { '$push': { users:req.param( 'name' ) } }, function( err ) {
          if( err ) { console.log( err.msg ); }
          res.redirect( '/projects/'+req.params.uri );
        });
      }
    });
  } else {
    res.redirect( '/projects/'+req.params.uri );
  }
};

Projects.prototype.removeUser = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, projects ) {
    if (projects && projects[0] ) {
      self._projects.update( { name:projects[0].name }, { '$pull': { users:req.param( 'name' ) } }, function( err ) {
        if( err ) { console.log( err.msg ); }
        res.redirect( '/projects/'+req.params.uri );
      });
    }
  });
};

Projects.prototype.addHerokuApp = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, projects ) {
    if (projects && projects[0] ) {
      self._projects.update( { name:projects[0].name }, { '$push': { herokuApps:req.param( 'appName' ) } }, function( err ) {
        if( err ) { console.log( err.msg ); }
        res.redirect( '/projects/'+req.params.uri );
      });
    }
  });
};

Projects.prototype.addNodejitsuApp = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, projects ) {
    if (projects && projects[0] ) {
      self._projects.update( { name:projects[0].name }, { '$push': { nodejitsuApps:req.param( 'appName' ) } }, function( err) {
        if( err ) { console.log( err.msg ); }
        res.redirect( '/projects/'+req.params.uri );
      });
    }
  });
};

Projects.prototype.enableSharing = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, projects ) {
    if (projects && projects[0] ) {
      self._rackspace.createContainer( projects[0].uri, function (err) {
        if (err) {
          console.log( err );
          res.redirect( '/projects/'+req.params.uri );
        } else {
          self._projects.update( { name:projects[0].name }, { '$set': { sharingEnabled:true, container:projects[0].uri } }, function( err ) {
            if( err ) { log.info( err.msg ); }
            res.redirect( '/projects/'+req.params.uri );
          });
        }
      });
    }
  });
};

Projects.prototype.enableHeroku = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, projects ) {
    if (projects && projects[0] ) {
      self._projects.update( { name:projects[0].name }, { '$set': { herokuEnabled:true } }, function( err ) {
        if (err) {
          console.log( err );
        }
        res.redirect( '/projects/'+req.params.uri );
      });
    }
  });
};

Projects.prototype.enableNodejitsu = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, projects ) {
    if (projects && projects[0] ) {
      self._projects.update( { name:projects[0].name }, { '$set': { nodejitsuEnabled:true } }, function( err ) {
        if (err) {
          console.log( err );
        }
        res.redirect( '/projects/'+req.params.uri );
      });
    }
  });
};

Projects.prototype.uploadFile = function( req, res, next ) {
  var self = this,
      form = new IncomingForm,
      done = false,
      container,
      hash,
      path,
      verified = false,
      pending = 0,
      sent = 0,
      socket;
  form.onPart = function(part) {
    if(!part.filename) {
      form.handlePart(part);
      return;
    }
    if (verified) {
      var file = encodeURIComponent(part.filename);
      pending++;
      var buffer = new BufferedStream();
      buffer.headers["content-disposition"] = 'attachment; name="'+file+'"; filename="'+file+'"';
      part.pipe(buffer);
      self._rackspace.saveStream( container, encodeURIComponent((path?path+"/":"")+file), buffer, function( err, success ) {
        if (err) {
          console.log( err );
        }
        sent++;
        socket.emit("send", Math.round(sent * 100 / pending)+"%");
        if(pending === sent) {
          socket.emit("done");
        }
      });
    }
  };
  form.on('field', function(name, val) {
    switch (name) {
      case "container":
        container = val;
        break;
      case "hash":
        hash = val;
        socket = sockets[hash];
        form.on('progress', function(received, expected) {
          var percent = Math.round(received * 100 / expected)+"%";
          socket.emit("upload", percent);
        });
        break;
      case "path":
        path = encodeURIComponent(val.replace(/(?:^\/+|\/+$)|\.\./g, ""));
        break;
      default:
        var obj = {};
        obj[name] = val;
        console.log(obj);
        break;
    }
    if(typeof container === "string" && typeof hash === "string" && typeof path === "string") {
      var bcrypt = require( 'bcrypt' );
      verified = bcrypt.compareSync(container, hash)
    }
  });
  form.on('error', function(err) {
    next(err);
    done = true;
  });
  form.on('end', function() {
    if(done) return;
    res.send(200);
    if(pending === 0) {
      socket.emit("done");
    }
  });
  form.parse(req);
};

Projects.prototype.getFiles = function( project, callback ) {
  var self = this;
  self._rackspace.getContainerFiles( project.container, function( err, files ) {
    if ( err ) {
      callback( err );
    } else if ( Array.isArray(files) ) {
      callback( null, files.channelize() );
    } else {
      callback( new Error( "files is not an array." ) );
    }
  });
};

Projects.prototype.streamFile = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, project ) {
    if ( project && project[0] ) {
      var path = req.param("path").replace(/(?:^\/+|\/+$)|\.\./g, "");
      self._rackspace.getStream( project[0].container, path.split("/").map(function (dir) {
        return encodeURIComponent(encodeURIComponent(dir));
      }).join("/"), res, function( err, obj ) {
        if (err) {
          console.log( err );
        }
      });
    } else {
      if(err) {
        console.log(err);
      }
      res.send(500, '');
    }
  });
};

Projects.prototype.removeFile = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, project ) {
    if (project && project[0] ) {
      var path = req.param("path").replace(/(?:^\/+|\/+$)|\.\./g, "");
      self._rackspace.remove( project[0].container, path.split("/").map(function (dir) {
        return encodeURIComponent(encodeURIComponent(dir));
      }).join("/"), function( err, success ) {
        if (err) {
          console.log(err);
        }
        res.redirect( '/projects/'+req.params.uri );
      });
    } else {
      if (err) {
        console.log(err);
      }
      res.redirect( '/projects/'+req.params.uri );
    }
  });
};

Projects.prototype.updateFile = function( req, res, next ) {
  var self = this,
      container = req.param( 'container' ),
      hash = req.param( 'hash' ),
      bcrypt = require( 'bcrypt' ),
      verified = bcrypt.compareSync(container, hash);
  if ( verified ) {
    var param = decodeURIComponent(req.param("path")).replace(/(?:^\/+|\/+$)|\.\./g, ""),
        name = decodeURIComponent(req.param("name")).replace(/\/|\.\./g, ""),
        path = param.split("/").map(function (dir) {
          return encodeURIComponent(dir);
        }),
        file = path.pop(),
        ext = file.split(".").pop(),
        newFile = encodeURIComponent(name+".")+ext,
        newPath = path.concat([newFile]).map(function (dir) {
          return encodeURIComponent(dir);
        }).join("/"),
        headers = {
          'content-disposition': 'attachment; name="'+newFile+'"; filename="'+newFile+'"',
          'destination': '/'+container+'/'+newPath
        };
    if (encodeURIComponent(file) === newFile) {
      res.send(200);
      return;
    }
    self._rackspace.renameFile( container, param.split("/").map(function (dir) {
      return encodeURIComponent(encodeURIComponent(dir));
    }).join("/"), headers, function (err, success) {
      if (err) {
        console.log(err);
      }
      res.writeContinue();
      self._rackspace.remove( container, param.split("/").map(function (dir) {
        return encodeURIComponent(encodeURIComponent(dir));
      }).join("/"), function( err, success ) {
        if (err) {
          console.log(err);
        }
        res.send(200);
      });
    });
  } else {
    res.send(409);
  }
};
