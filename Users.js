function sanitize( str ) {
  if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' );
  return "";
}

//
var Users = exports.Users = function( spec ) {
  this._mongo = spec.mongo || null;
  this._conf = spec.conf || {};

  this._users = this._mongo.getCollection( 'users' );
};

// check to see if the user has been authenticated

Users.prototype.authenticate = function( req, res, next ) {
	if( !req.session ) { return res.redirect( '/authenticate' ); }
	if( req.session.authenticated ) { return next(); }
	else { return res.redirect( '/authenticate' ); }
};

// check the password for the specified user

Users.prototype.checkPassword = function( req, res, next ) {
  var self = this;
  var pass = req.param('password');
  var name = req.param('username');
  var bcrypt = require('bcrypt');
  
  self._users.find( { name:name }, {} ).toArray( function( error, user ) {
  	if( error ) { console.log( require('util').inspect( error ) ); }
		if( user && user[0] && user[0].pass && bcrypt.compareSync( pass, user[0].pass ) ) {
			return req.session.regenerate( function( error ) {
				req.session.invalid = null;
      	req.session.authenticated = true;
      	req.session.name = user[0].name;
        req.session.type = user[0].type;
      	res.redirect( '/dashboard' );
    	});
    }
    // password is invalid or no user specified
  	req.session.regenerate( function( error ) {
    	req.session.authenticated = false;
  		req.session.invalid = ['invalid username / password'];
  		res.redirect( '/authenticate' );
  	});
  });
};

// set the password for the specified user

Users.prototype.setPassword = function( req, res, next ) {
	var self = this;
	var pass = req.param( 'password' );
	var pass2 = req.param( 'password2' );
	var name = req.param( 'username' );

	// early out if the passwords do not match
  if( pass !== pass2 ) {
  	res.redirect( '/dashboard' );
  }

  // encrypt the password
	var bcrypt = require( 'bcrypt' );
  var salt = bcrypt.genSaltSync(10);  
  var hash = bcrypt.hashSync(pass, salt);

  // store it in the database
	self._users.update( { name:name }, { '$set':{ pass:hash } }, function( err ) {
  	if( err ) { console.log( err.msg ); }
    res.redirect( '/dashboard' );
	});
};

Users.prototype.addUser = function( req, res, next ) {
  var self = this;
  var pass = req.param( 'password' );
  var name = req.param( 'name' );
  var type = req.param( 'type' );
  var id   = sanitize( name ).toLowerCase();
  if(id) {
    self._users.find( { id:id }, {} ).toArray( function( err, user ) {
      if (err) { console.log( err.msg ); }
      if (!user || !user[0] ) {
        //no conflicts
        var bcrypt = require( 'bcrypt' );
        var salt = bcrypt.genSaltSync(10);
        var hash = bcrypt.hashSync(pass, salt);

        self._users.insert( { name:name, pass:hash, type:type, id:id }, { safe:true }, function( err ) {
          if( err ) { console.log( err.msg ); }
          res.redirect( '/dashboard' );
        });
      } else {
        //conflicting username
        res.redirect( '/dashboard' );
      }
    });
  } else {
    res.redirect( '/dashboard' );
  }
};

Users.prototype.getAllUsers = function( callback ) {
  var self = this;
  self._users.find( {}, { name:1, type:1, id:1 } ).toArray( callback );
};

Users.prototype.getAllClients = function( callback ) {
  var self = this;
  self._users.find( { type:"client" }, { name:1 } ).toArray( callback );
};

Users.prototype.find = function( id, callback ) {
  var self = this;
  self._users.find( { id:id }, { name:1, id:1, type:1 } ).toArray( callback );
};