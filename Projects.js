var IncomingForm = require('formidable').IncomingForm;
var qs = require('qs');
var BufferedStream = require('./BufferedStream').BufferedStream;

// sockets will be stored according to hash values on project pages

var io;
var sockets = {};

function randomStr(size) {
  var names = ["bar", "bat", "bay"];
  var length = names.length;
  return names[Math.floor(Math.random()*length)];
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
  var formatFile = function (file, name) {
    bytes = file.bytes;
    date = new Date(file.lastModified);
    return {
      name: unescape(name),
      filename: name,
      path: file.name,
      bytes: bytes,
      date: date,
      prettyDate: (date.toDateString().split(" ").slice(1).join(" "))+" "+date.toLocaleTimeString(),
      type: file.contentType,
      size: (function () {
        var bytes = file.bytes;
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
    var path = unescape("root/"+randomStr()+"/"+file.name).split("/");
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
            files: []
          });
          cwd = cwd.files[index];
        } else {
          cwd.files.push(formatFile(file, dir)); 
        }
      } else {
        if(path.length) {
          cwd = cwd.files[index];
        } else {
          cwd.files.push(formatFile(file, dir));
        }
      }
    }
  });
  //calculates and sorts the directories
  (function (dir) {
    var self = arguments.callee;
    var bytes = 0;
    var date;
    var files = dir.files;
    var i = files.length;
    while(i--) {
      if(files[i].isDirectory) {
        var stats = self(files[i]);
        console.log(stats);
        bytes += stats.bytes;
        if(typeof date === "undefined") {
          date = stats.date;
        } else if(date < stats.date) {
          date = stats.date;
        }
      } else {
        bytes += files[i].bytes;
        if(typeof date === "undefined") {
          date = files[i].date;
        } else if(date < files[i].date) {
          date = files[i].date;
        }
      }
    }
    files.sort(function (a, b) {
      var comp = a.name.localeCompare(b.name);
      if(comp === 0) {
        if(a.isDirectory) return -1;
        return 1;
      }
      return comp;
    });
    dir.bytes = bytes;
    dir.date = date;
    dir.prettyDate = (date.toDateString().split(" ").slice(1).join(" "))+" "+date.toLocaleTimeString();
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
  io.sockets.on("connection", function (socket) {
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
      var file = escape(part.filename);
      pending++;
      part.headers["content-disposition"] = 'form-data; name="'+file+'"; filename="'+file+'"';
      var buffer = new BufferedStream();
      part.pipe(buffer);
      self._rackspace.saveStream( container, escape(file), buffer, function( err, success ) {
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
      default:
        var obj = {};
        obj[name] = val;
        console.log(obj);
        break;
    }
    if(typeof container === "string" && typeof hash === "string") {
      var bcrypt = require( 'bcrypt' );
      verified = bcrypt.compareSync(container, hash);
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
      self._rackspace.getStream( project[0].container, escape(escape(req.params.file)), res, function( err, obj ) {
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
      self._rackspace.remove( project[0].container, escape(escape(req.params.file)), function( err, success ) {
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
    var file = req.params.file,
        ext = file.split( '.' ).pop(),
        newFile = escape(req.param( 'name' )+'.'+ext),
        headers = {
          'content-disposition': 'form-data; name="'+newFile+'"; filename="'+newFile+'"',
          'destination': '/'+container+'/'+escape(newFile)
        };
    if (newFile === file) {
      res.send(200);
      return;
    }
    self._rackspace.renameFile( container, escape(escape(file)), headers, function (err, success) {
      if (err) {
        console.log(err);
      }
      res.writeContinue();
      self._rackspace.remove( container, escape(escape(file)), function( err, success ) {
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
