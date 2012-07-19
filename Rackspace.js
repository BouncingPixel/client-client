
var cloudfiles = require('cloudfiles'),
    async = require('async');
var _config, _self;

//
var Rackspace = exports.Rackspace = function( spec ) {
  _config = {
    auth: {
      username: spec.username,
      apiKey: spec.apiKey
    },
    path: '/tmp'
  };

  _self = this;
};

var init = function (next, sync) {
  if (_self.expired()) {
    _self.client = cloudfiles.createClient( _config );
    _self.client.setAuth( function (err, res, config) {
      if( err ) { return next( err ); }
      _self.expiry = new Date().getTime() + 23*60*60*1000;
      next();
    });
  } else {
    next();
  }
}

Rackspace.prototype.expired = function () {
  return !this.expiry || this.expiry < new Date().getTime();
}

//
Rackspace.prototype.saveFile = function( containerName, imageName, path, callback ) {
  init( function (err) {
    if( err ) { 
      console.log("Rackspace Save File: " + err);
      return callback( err ); 
    }
    _self.client.addFile( containerName, { remote:imageName, local:path }, callback );
  });
};

//
Rackspace.prototype.saveStream = function( containerName, imageName, stream, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }
    _self.client.addFile( containerName, 
      { remote:imageName, stream:stream, headers: stream.headers }, 
      callback );
  });
};

//
Rackspace.prototype.get = function( containerName, imageName, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }
    _self.client.getFile( containerName, imageName, callback );
  });
};

Rackspace.prototype.renameFile = function( containerName, imageName, headers, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }
    _self.client.renameFile( containerName, { remote:imageName, headers: headers }, callback );
  });
}

//
Rackspace.prototype.getStream = function( containerName, imageName, stream, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }
    _self.client.getFile( containerName, imageName, stream, callback );
  });
};


//
Rackspace.prototype.getFiles = function( containerName, imageName, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }
    _self.client.getFiles( containerName, imageName, callback );
  });
};

//
Rackspace.prototype.getContainerFiles = function( containerName, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }
    _self.client.getFiles( containerName, callback );
  });
};

//
Rackspace.prototype.getContainers = function( isCDN, callback ) {
  init( function ( err ) {
    if( err ) { return callback( err ); }

    if ("function" === typeof (isCDN)) {
      callback = isCDN;
      isCDN = null;
    }
    _self.client.getContainers( isCDN, callback );
  });
};

// Remove a number of files from the CDN.
// Can also take a sing file name.
// If no files provided, remove the whole
Rackspace.prototype.remove = function( containerName, files, callback ) {
  init( function( err ) {
    if( err ) { return callback( err ); }

    if ("function" === typeof(files)) {
      callback = files;
      files = null;
      return _self.client.destroyContainer(containerName, callback);
    }

    if (!(files instanceof Array)) files = [files];

    function destroyFile (file, next) {
      _self.client.destroyFile( containerName, file, next );
    }

    async.forEach(files, destroyFile, callback);
  });
};

// Creates a Container in the CDN.
Rackspace.prototype.createContainer = function( containerName, callback ) {
  init( function( err ) {
    if( err ) { return callback( err ); }

    return _self.client.createContainer(containerName, callback);
  });
}