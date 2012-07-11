var request = require("request");

var toBase64 = function (username, apiKey) {
	return new Buffer(username+":"+apiKey).toString('base64');
};

var sanitize = function (str) {
  if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' );
  return "";
}

exports.HerokuClient = HerokuClient = function ( spec ) {
	this.config = spec;
	this.defaultHeaders = {
		Accept: "application/json",
		Authorization: "Basic "+toBase64(this.config.username, this.config.apiKey)
	};
};

HerokuClient.prototype = {
	defaultToJSON: function(){
		this.defaultHeaders["Accept"] = "application/json";
	},
	defaultToXML: function() {
		this.defaultHeaders["Accept"] = "application/xml";
	},
	getDefaultHeaders: function() {
		var headers = {};
		var self = this;
		Object.getOwnPropertyNames(self.defaultHeaders).forEach(function (header) {
			headers[header] = self.defaultHeaders[header];
		});
		return headers;
	},
	listApps: function (callback){
		var uri = "https://api.heroku.com/apps";
		var headers = this.getDefaultHeaders();
		var method = "GET";
		var options = {
			uri:uri,
			headers:headers,
			method:method
		};
		return request(options, function (err, res, body) {
			callback(err, body);
		});
	},
	getInfo: function (appName, callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+sanitize(appName);
			var headers = this.getDefaultHeaders();
			var method = "GET";
			var options = {
				uri:uri,
				headers:headers,
				method:method
			};
			return request(options, function (err, res, body){
				callback(err, body);
			});
		} else {
			return new Error("Invalid appName");
		}
	},
	create: function (appName,callback){},
	rename: function (appName,newName,callback){},
	transfer: function (appName,newOwner,callback){},
	toggleMaintenance: function (appName,mode,callback){},
	destroy: function (appName,callback){},
	listCollaborators: function (appName,callback){},
	addCollaborator: function (appName,collaborator,callback){},
	removeCollaborator: function (appName,collaborator,callback){},
	listDomains: function (appName,callback){},
	addDomain: function (appName,domain,callback){},
	removeDomain: function (appName,domain,callback){},
	getLogs: function (appName,lines,process,source,tail,callback){},
	listProcesses: function (appName,callback){},
	runProcess: function (appName,attach,command,callback){},
	restart: function (appName,process,type,callback){},
	stop: function (appName,process,type,callback){},
	scale: function (appName,type,qty,callback){},
	listReleases: function (appName,callback){},
	rollback: function (appName,release,callback){},
	listAddonsInstalled: function (appName,callback){},
	listConfigVars: function (appName, callback){}
};