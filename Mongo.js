var mongoDB = require('mongodb').Db;
var mongoServer = require('mongodb').Server;
var async = require('async');

//
// dbInfo = { 
//   name:'',
//   url:'',
//   port:'',
//   username:'',
//   password:'',
//   collections:[],
// }

var Mongo = exports.Mongo = function( dbInfo ) {
  this._dbInfo = dbInfo;
  this._indexCollectionName = dbInfo.indexCollection || "indicies";
  this._db = new mongoDB( dbInfo.name, new mongoServer( dbInfo.url, dbInfo.port, { auto_reconnect:true } ), {} );
  this._collections = {};
};

Mongo.prototype._loadCollection = function( collectionName, callback ) {
  var self = this;
  self._db.collection( collectionName, function( error, collection ) {
    if( error ) { return callback( error ); }
    self._collections[ collectionName ] = collection;
    return callback( null, collection );
  });
};

exports.createMongo = function( dbInfo ) {
  return new Mongo( dbInfo );
};

Mongo.prototype.connect = function( callback ) { 
  var self = this;
  self._db.open( function( p_db ) { 
    self._db.authenticate( self._dbInfo.username, self._dbInfo.password, function( error ) {
      var collections = self._dbInfo.collections;
      var fn = function( collectionName, callback ) {
        self._loadCollection( collectionName, callback );
      };
      collections.push( self._indexCollectionName );
      async.forEach( collections, fn, callback );
    });
  });
};

Mongo.prototype.getCollection = function( collectionName ) {
  if( this._collections[ collectionName ] ) { return this._collections[ collectionName ]; }
  throw new Error( collectionName + " not loaded in Mongo" );
};

Mongo.prototype.nextIndex = function( collectionName, callback ) {
  var query = { "collectionName":collectionName };
  var sort = [[ '_id', 'ascending' ]];
  var action = { $inc:{ val:1 } };
  var options = { upsert:true };
  var collection = this._collections[ this._indexCollectionName ];
  collection.findAndModify( query, sort, action, options, function( error, indexDoc ) {
    if( error ) { return callback( error ); }
    return callback( null, indexDoc.val );
  });
};

Mongo.prototype.checkForError = function( callback ) {
  this._db.lastError( function( error, lastError ) {
    if( lastError && lastError.length && lastError[0].err != null ) { callback( lastError[0].err ); }
    callback( null );
  });
};

Mongo.prototype.getDB = function() {
  return this._db;
};
