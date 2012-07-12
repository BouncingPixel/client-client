var request = require("request");

var toBase64 = function (username, apiKey) {
	return new Buffer(username+":"+apiKey).toString('base64');
};

var sanitize = function (str) {
  if(str && typeof str === "string") return str.replace( /[^a-zA-Z\d_\-]/g, '' );
  return "";
}

var HerokuClient = exports.HerokuClient = function ( spec ) {
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
			var uri = "https://api.heroku.com/apps/"+appName;
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
			callback(new Error("Invalid appName"));
		}
	},
	create: function (appName,callback){},
	rename: function (appName,newName,callback){},
	transfer: function (appName,newOwner,callback){},
	toggleMaintenance: function (appName,mode,callback){},
	destroy: function (appName,callback){},
	listCollaborators: function (appName,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/collaborators";
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
			callback(new Error("Invalid appName"));
		}
	},
	addCollaborator: function (appName,collaborator,callback){},
	removeCollaborator: function (appName,collaborator,callback){},
	listDomains: function (appName,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/domains";
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
			callback(new Error("Invalid appName"));
		}
	},
	addDomain: function (appName,domain,callback){},
	removeDomain: function (appName,domain,callback){},
	getLogs: function (appName,num,ps,source,tail,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/logs";
			var headers = this.getDefaultHeaders();
			var method = "GET";
			var query = "logplex=true";
			if(typeof num === "number") query += "&num="+num;
			if(typeof ps === "string") query += "&ps="+escape(string);
			if(typeof source === "string") query += "&source="+escape(source);
			if(tail) query += "&tail=1";
			var options = {
				uri:uri+"?"+query,
				headers:headers,
				method:method
			};
			return request(options, function (err, res, body){
				callback(err, body);
			});
		} else {
			callback(new Error("Invalid appName"));
		}
	},
	listProcesses: function (appName,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/ps";
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
			callback(new Error("Invalid appName"));
		}
	},
	runProcess: function (appName,attach,command,callback){},
	restart: function (appName,ps,type,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/ps/restart";
			var headers = this.getDefaultHeaders();
			var method = "POST";
			var query = "";
			if(typeof ps === "string") query += "ps="+escape(ps);
			if(typeof type === "string") {
				if(query.length) query += "&type="+escape(type);
				else query += "type="+escape(type);
			}
			var options = {
				uri:uri+"?"+query,
				headers:headers,
				method:method
			}
			return request(options, function (err, res, body) {
				callback(err, body);
			});
		} else {
			callback(new Error("Invalid appName"));
		}
	},
	stop: function (appName,ps,type,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/ps/stop";
			var headers = this.getDefaultHeaders();
			var method = "POST";
			var query = "";
			if(typeof ps === "string") query += "ps="+escape(ps);
			if(typeof type === "string") {
				if(query.length) query += "&type="+escape(type);
				else query += "type="+escape(type);
			}
			var options = {
				uri:uri+"?"+query,
				headers:headers,
				method:method
			}
			return request(options, function (err, res, body) {
				callback(err, body);
			});
		} else {
			callback(new Error("Invalid appName"));
		}
	},
	scale: function (appName,type,qty,callback){},
	listReleases: function (appName,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/releases";
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
			callback(new Error("Invalid appName"));
		}
	},
	rollback: function (appName,release,callback){},
	listAddonsInstalled: function (appName,callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/addons";
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
			callback(new Error("Invalid appName"));
		}
	},
	listConfigVars: function (appName, callback){
		appName = sanitize(appName);
		if(appName) {
			var uri = "https://api.heroku.com/apps/"+appName+"/config_vars";
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
			callback(new Error("Invalid appName"));
		}
	}
};