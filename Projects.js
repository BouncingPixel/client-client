var IncomingForm = require('formidable').IncomingForm;
var qs = require('qs');

// sockets will be stored according to hash values on project pages

var io;
var sockets = {};

function sanitize( str ) {
  if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' );
  return "";
}

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
    self._projects.insert( { name:name, uri:parsedName, users:[] }, { safe:true }, function( err ) {
      if( err ) { console.log( err.msg ); }
      res.redirect( '/projects/'+parsedName );
    });
  } else {
    res.redirect( '/dashboard' );
  }
};

Projects.prototype.find = function( uri, callback ) {
  var self = this;
  self._projects.find( { uri:uri }, { name:1, users:1, uri:1, sharingEnabled:1, container:1 } ).toArray( callback );
};

Projects.prototype.getAllProjects = function( callback ) {
  var self = this;
  self._projects.find( {}, { name:1, uri:1 } ).toArray( callback );
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
  form.on("progress", function (received, expected) {
    total = expected;
  });
  form.onPart = function(part) {
    if(!part.filename) {
      form.handlePart(part);
      return;
    }
    if (verified) {
      var name = part.filename.replace(/\.[^\.]*/g,""),
          ext = part.filename.replace(/[^\.]*/,""),
          file = escape(name)+ext;
      pending++;
      part.headers["content-disposition"] = 'form-data; name="'+file+'"; filename="'+file+'"';
      self._rackspace.saveStream( container, escape(file), part, function( err, success ) {
        if (err) {
          console.log( err );
        }
        sent++;
        socket.emit("send", Math.round(sent * 100 / pending)+"%");
        if(pending === sent) {
          socket.emit("done");
          delete sockets[hash];
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
  });
  form.parse(req);
};

Projects.prototype.getFiles = function( project, callback ) {
  var self = this;
  self._rackspace.getContainerFiles( project.container, function( err, files ) {
    if ( err ) {
      callback( err );
    } else if ( Array.isArray(files) ) {
      callback( null, files.map( function( file ) {
        return {
          props:Object.getOwnPropertyNames( file ).filter(function( prop ) {
            switch(prop) {
              case "name":
              case "contentType":
              case "container":
              case "bytes":
                return true;
              default:
                return false;
            }
          }).map( function( prop ) {
            switch(prop) {
              case "name":
                return { prop:"Name", val:unescape(file[prop]) };
              case "contentType":
                return { prop: "Content-Type", val:file[prop] };
              case "container":
                return { prop: "Container", val:file[prop] };
              case "bytes":
                var bytes = file[prop];
                if(bytes < 1024) {
                  return { prop:"Bytes", val:bytes };
                } else if(bytes < 1024*1024) {
                  return { prop: "Kilobytes", val:(bytes/1024).toFixed(1) };
                } else if(bytes < 1024*1024*1024) {
                  return { prop: "Megabytes", val:(bytes/(1024*1024)).toFixed(1) };
                } else if(bytes < 1024*1024*1024*1024) {
                  return { prop: "Gigabytes", val:(bytes/(1024*1024*1024)).toFixed(1) };
                } else {
                  return { prop: "Terabytes", val:(bytes/(1024*1024*1024*1024)).toFixed(1) };
                }
            }
          }),
          name: file.name
        };
      }) );
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
    var newName = req.param( 'name' ).replace(/\.[^\.]*/g,""),
        name = req.params.file.replace(/\.[^\.]*/g,""),
        ext = req.params.file.replace(/[^\.]*/,""),
        newFile = escape(newName)+ext,
        file = req.params.file,
        headers = {
          'content-disposition': 'form-data; name="'+newFile+'"; filename="'+newFile+'"',
          'destination': '/'+container+'/'+escape(newFile)
        };
    if (newFile === file) {
      res.send(200);
      return;
    }
    self._rackspace.updateFile( container, escape(escape(file)), headers, function (err, success) {
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