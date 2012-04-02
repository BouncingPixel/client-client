
//
var Users = exports.Users = function( spec ) {
  this._mongo = spec.mongo || null;
  this._conf = spec.conf || {};

  this._users = this._mongo.getCollection( 'users' );
};

// check to see if the user has been authenticated

Users.prototype.authenticate = function( req, res, next ) {
	if( !req.session ) { return res.redirect( 'authenticate' ); }
	if( req.session.authenticated ) { return next(); }
	else { return res.redirect( 'authenticate' ); }
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
      	res.redirect( 'dashboard' );
    	});
    }
    // password is invalid or no user specified
  	req.session.regenerate( function( error ) {
    	req.session.authenticated = false;
  		req.session.invalid = ['invalid username / password'];
  		res.redirect( 'authenticate' );
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
  	return res.send( { status:'failure', message:'Passwords do not match.' } );
  }

  // encrypt the password
	var bcrypt = require( 'bcrypt' );
  var salt = bcrypt.gen_salt_sync(10);  
  var hash = bcrypt.encrypt_sync(pass, salt);

  // store it in the database
	self._users.update( { name:name }, { '$set':{ pass:hash } }, function( err ) {
  	if( err ) { return res.send( { status:'failure', message:err.msg, err:err } ); }
  	res.send( { status:'success', message:'Password successfully changed.' } );
	});
};