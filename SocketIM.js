// various authorization functions

exports.excludeXDomain = function (handshake, callback) {
	callback(null, !handshake.xdomain);
};

exports.filterSecure = function (handshake, callback) {
	callback(null, handshake.secure);
};

// SocketIM(io, [path, authorize])
//
// io = socket.io instance
// path = String
// authorize(handshake, callback)
//   callback(err, isAuthorized)

exports.SocketIM = function (io, path, authorize) {
	// map {username:socket}
	var users = {};
	// map {socket.id:username}
	var ids = {};
	var nsp = path.replace(/^\/+|\/$/g, "");
	return io.of(path).authorization(authorize).on("connection", function (socket) {
		var user,
				others = [];
		socket.on("id", function (data) {
			user = data.username;
			if(!Array.isArray(users[user])) {
				users[user] = [socket];
			} else {
				users[user].push(socket);
			}
			ids[socket.id] = user;
			var rooms = data.rooms;
			for(var room=0;room<rooms.length;room++) {
				socket.join(rooms[room]);
				var clients = io.sockets.clients(nsp+"/"+rooms[room]);
				for(var id=0;id<clients.length;id++) {
					if(others.indexOf(ids[clients[id].id]) === -1 && clients[id].id !== socket.id) {
						others.push(ids[clients[id].id]);
						users[ids[clients[id].id]].forEach(function (socket) {
							socket.emit("join", user);
						});
					}
				}
			}
			socket.emit("subscribe", others);
			socket.on("chat", function (data) {
				if(data.user && users[data.user]) {
					users[data.user].forEach(function (socket) {
						socket.emit("chat", {"from":user, "message":data.message});
					});
				}
				if(data.room && io.sockets.clients(data.room)) {
					socket.broadcast.to(data.room).emit("chat", {"from":user, "message":data.message, "room":data.room});
				}
			});
			socket.on("disconnect", function () {
				users[user].splice(users[user].indexOf(socket), 1);
				delete ids[socket.id];
				for(var i=0;i<others.length;i++) {
					users[others[i]].forEach(function (socket) {
						socket.emit("part", user);
					});
				}
			});
		});
	});
};