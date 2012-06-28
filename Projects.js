var IncomingForm = require('formidable').IncomingForm;
var qs = require('qs');

function sanitize( str ) {
  if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' );
  return "";
}

function ondata(name, val, data){
  if (Array.isArray(data[name])) {
    data[name].push(val);
  } else if (data[name]) {
    data[name] = [data[name], val];
  } else {
    data[name] = val;
  }
}

var Projects = exports.Projects = function( spec ) {
  this._mongo = spec.mongo || null;
  this._conf = spec.conf || {};

  this._projects = this._mongo.getCollection( 'projects' );
  this._rackspace = spec.rackspace;
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
      pending = 0,
      done = false,
      data = {},
      container,
      hash,
      verified = false;
  form.onPart = function(part) {
    if(!part.filename) {
      form.handlePart(part);
      return;
    }
    if (verified) {
      console.log("initializing stream");
      console.log( "container: "+data.container );
      pending++;
      part.headers["content-disposition"] = 'form-data; name="'+part.filename.replace(/\.[a-zA-Z\d]*/,"")+'"; filename="'+part.filename+'"';
      self._rackspace.saveStream( data.container, part.filename, part, function( err, success ) {
        if (err) {
          console.log( err );
        }
        pending--;
        console.log('stream closed');
        form._maybeEnd();
      });
    }
  };
  form._maybeEnd = function() {
    if (!this.ended || this._flushing || pending > 0) {
      return;
    }
    form.emit('end');
  };
  form.on('field', function(name, val) {
    ondata(name, val, data);
    if(name === "container") {
      container = val;
    }
    if(name === "hash") {
      hash = val;
    }
    if(typeof container === "string" && typeof hash === "string") {
      var bcrypt = require( 'bcrypt' );
      verified = bcrypt.compareSync(container, hash);
      console.log("verified");
    }
  });
  form.on('error', function(err) {
    next(err);
    done = true;
  });
  form.on('end', function() {
    if(done) return;
    try {
      req.body = qs.parse(data);
    } catch(err) {
      console.log(err);
    }
    res.redirect( '/projects/'+req.params.uri );
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
            return typeof file[prop] === "string" && file[prop];
          }).map( function( prop ) {
            return { prop:prop, val:file[prop] };
          }),
          name:file.name
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
    if (project && project[0] ) {
      self._rackspace.getStream( project[0].container, req.params.file, res, function( err, obj ) {
        if (err) {
          console.log( err );
        }
      });
    } else {
      if(err) {
        console.log(err);
      }
      res.send(404, '');
    }
  });
};

Projects.prototype.removeFile = function( req, res, next ) {
  var self = this;
  self.find( req.params.uri, function( err, project ) {
    if (project && project[0] ) {
      self._rackspace.remove( project[0].container, req.params.file, function( err, success ) {
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