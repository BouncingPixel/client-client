$(function () {
	var socket = io.connect("/chat");
	var username = $("#username").val();
	socket.on("connect", function () {
		socket.emit("id", {
			username:username,
			rooms:rooms
		});
	});
	var users = [],
			rooms = $(".roomname").toArray().map(function (el) {
				return $(el).val();
			}),
			$chatRec = $("#chat-recipients"),
			$chatLogs = $("#chat-logs");
	for(var i=0;i<rooms.length;i++) {
		(function () {
			var room = rooms[i];
			$("<a href=\"#\"/>").html(room).wrap("<li/>").parent().appendTo($chatRec).one("click", function (e) {
				var $accordion = $("<a href=\"#\"/>").attr("data-toggle", "collapse").attr("data-parent", "#chat-logs").attr("data-target", "#room-"+room).html(room).addClass("btn btn-inverse accordion-toggle").wrap("<div class=\"accordion-heading\"/>").parent().wrap("<div class=\"accordion-group\"/>").parent();
				$("<div class=\"accordion-body collapse\"/>").attr("id", "room-"+room).html("<div class=\"chat-wrapper\"><dl class=\"dl-horizontal chat-box\"/></div>").appendTo($accordion);
				$accordion.prependTo($chatLogs);
				$accordion.find(".accordion-heading a").trigger("click");
			});
		})();
	}
	socket.on("subscribe", function (data) {
		var add = data.map(function (user) {
			if(users.indexOf(user) === -1) return user;
		}).filter(function (user) {
			return !!user;
		});
		users.forEach(function (user) {
			if(data.indexOf(user) === -1) $("#user-"+user+" .chat-box").append("<dt></dt><dd>"+user+" parted.</dd>");
		});
		users = data;
		for(var i=0;i<add.length;i++) {
			(function () {
				var user = add[i];
				if($("[data-user=\""+user+"\"]")[0]) return;
				var $rec = $("<a href=\"#\" data-user=\""+user+"\"/>").html(user).wrap("<li/>").parent().prependTo($chatRec);
				if($("#user-"+user)[0]) $("#user-"+user+" .chat-box").append("<dt></dt><dd>"+user+" joined.</dd>");
				else $rec.one("click", function (e) {
					var $accordion = $("<a href=\"#\"/>").attr("data-toggle", "collapse").attr("data-parent", "#chat-logs").attr("data-target", "#user-"+user).html(user).addClass("btn btn-inverse accordion-toggle").wrap("<div class=\"accordion-heading\"/>").parent().wrap("<div class=\"accordion-group\"/>").parent();
					$("<div class=\"accordion-body collapse\"/>").attr("id", "user-"+user).html("<div class=\"chat-wrapper\"><dl class=\"dl-horizontal chat-box\"/></div>").appendTo($accordion);
					$accordion.prependTo($chatLogs);
					$accordion.find(".accordion-heading a").trigger("click");
				});
			})();
		}
	});
	socket.on("join", function (user) {
		if(users.indexOf(user) === -1) {
			users.push(user);
			if($("[data-user=\""+user+"\"]")[0]) return;
			var $rec = $("<a href=\"#\" data-user=\""+user+"\"/>").html(user).wrap("<li/>").parent().prependTo($chatRec);
			if($("#user-"+user)[0]) {
				var $chatBox = $("#user-"+user+" .chat-box").append("<dt></dt><dd>"+user+" joined.</dd>");
				autoScroll($chatBox);
			} else $rec.one("click", function (e) {
				var $accordion = $("<a href=\"#\"/>").attr("data-toggle", "collapse").attr("data-parent", "#chat-logs").attr("data-target", "#user-"+user).html(user).addClass("btn btn-inverse accordion-toggle").wrap("<div class=\"accordion-heading\"/>").parent().wrap("<div class=\"accordion-group\"/>").parent();
				$("<div class=\"accordion-body collapse\"/>").attr("id", "user-"+user).html("<div class=\"chat-wrapper\"><dl class=\"dl-horizontal chat-box\"/></div>").appendTo($accordion);
				$accordion.prependTo($chatLogs);
				$accordion.find(".accordion-heading a").trigger("click");
			});
		}
	});
	socket.on("part", function (user) {
		if(users.indexOf(user) >= 0) {
			var $chatBox = $("#user-"+user+" .chat-box").append("<dt></dt><dd>"+user+" parted.</dd>");
			autoScroll($chatBox);
			$("[data-user=\""+user+"\"]").remove();
			users.splice(users.indexOf(user), 1);
		}
	});
	socket.on("chat", function (data) {
		var from = data.from;
		var message = (data.message||"").replace(/[<>&]/g, function(str) {
			switch(str) {
				case "<":
					return "&lt;";
				case ">":
					return "&gt;";
				case "&":
					return "&amp;";
			}
		}).trim();
		var room = data.room,
				$chatBox;
		if(room) {
			$chatBox = $("#chat-logs #room-"+room+" .chat-box");
			if($chatBox[0]) {
				$chatBox.append("<dt>"+from+":</dt><dd>"+message+"</dd>");
			} else {
				var $accordion = $("<a href=\"#\"/>").attr("data-toggle", "collapse").attr("data-parent", "#chat-logs").attr("data-target", "#room-"+room).html(room).addClass("btn btn-inverse accordion-toggle").wrap("<div class=\"accordion-heading\"/>").parent().wrap("<div class=\"accordion-group\"/>").parent();
				$("<div class=\"accordion-body collapse\"/>").attr("id", "room-"+room).html("<div class=\"chat-wrapper\"><dl class=\"dl-horizontal chat-box\"/></div>").appendTo($accordion);
				$accordion.prependTo($chatLogs);
				$chatBox = $accordion.find(".chat-box").append("<dt>"+from+":</dt><dd>"+message+"</dd>");
				$chatRec.find("[data-target=\"#room-"+room+"\"").off("click");
			}
		} else {
			$chatBox = $("#chat-logs #user-"+from+" .chat-box");
			if($chatBox[0]) {
				$chatBox.append("<dt>"+from+":</dt><dd>"+message+"</dd>");
			} else {
				var $accordion = $("<a href=\"#\"/>").attr("data-toggle", "collapse").attr("data-parent", "#chat-logs").attr("data-target", "#user-"+from).html(from).addClass("btn btn-inverse accordion-toggle").wrap("<div class=\"accordion-heading\"/>").parent().wrap("<div class=\"accordion-group\"/>").parent();
				$("<div class=\"accordion-body collapse\"/>").attr("id", "user-"+from).html("<div class=\"chat-wrapper\"><dl class=\"dl-horizontal chat-box\"/></div>").appendTo($accordion);
				$accordion.prependTo($chatLogs);
				$chatBox = $accordion.find(".chat-box").append("<dt>"+from+":</dt><dd>"+message+"</dd>");
				$chatRec.find("[data-target=\"#user-"+from+"\"").off("click");
			}
		}
		autoScroll($chatBox);
		if($chatBox.parent().parent().hasClass("in")) return;
		$chatBox.parent().parent().parent().find("a[data-toggle=\"collapse\"][data-parent=\"#chat-logs\"]").removeClass("btn-inverse").addClass("btn-primary").one("click", function (e) {
			$(this).removeClass("btn-primary").addClass("btn-inverse");
		});
	});
	function autoScroll($chatBox) {
		var scrollTop = $chatBox.parent().scrollTop();
		var viewHeight = $chatBox.parent().height();
		var postHeight = $chatBox.children().last().height();
		var chatHeight = $chatBox.height();
		if(scrollTop+viewHeight+postHeight>=chatHeight) {
			$chatBox.parent().scrollTop(chatHeight);
		} else {
			$chatBox.parent().parent().parent().find("a[data-toggle=\"collapse\"][data-parent=\"#chat-logs\"]").removeClass("btn-inverse").addClass("btn-primary");
		}
	}
	function checkForReturn(e) {
		$("#chat-logs .accordion-group:has(.in)").find("a[data-toggle=\"collapse\"][data-parent=\"#chat-logs\"]").removeClass("btn-primary").addClass("btn-inverse");
		if((e.key && e.key === "Enter")||(!e.key && e.keyCode === 13)) postMessage();
	}
	function postMessage() {
		var $this = $("#chat-input");
		if($this.val().trim()) {
			var target = $("#chat-logs .in").attr("id").split("-");
			var type = target.shift();
			var to = target.join("-");
			var $chatBox;
			if(type === "user" && users.indexOf(to) === -1) {
				$chatBox = $("#chat-logs .in .chat-box").append("<dt></dt><dd>"+to+" is not online.</dd>");
				$chatBox.parent().scrollTop($chatBox.height());
				return;
			}
			var message = $this.val().replace(/[<>&]/g, function(str) {
				switch(str) {
					case "<":
						return "&lt;";
					case ">":
						return "&gt;";
					case "&":
						return "&amp;";
				}
			}).trim();
			$chatBox = $("#chat-logs .in .chat-box").append("<dt>"+username+":</dt><dd>"+message+"</dd>");
			$chatBox.parent().scrollTop($chatBox.height());
			var json = {"message":message};
			json[type] = to;
			socket.emit("chat", json);
			$this.val("");
		}
	}
	$("#chat-input").on("focus", function (e) {
		if(!$("#chat-logs .in")[0]) {
			var $accordions = $chatLogs.find(".accordion-heading a");
			if($accordions.length === 1) {
				$accordions.trigger("click");
				return;
			}
			$(this).blur();
			if($accordions.length === 0) {
				$("#chat-button").removeClass("btn-inverse").addClass("btn-primary").one("click", function (e) {
					$(this).removeClass("btn-primary").addClass("btn-inverse");
				});
			}
		} else {
			$("#chat-logs .accordion-group:has(.in)").find("a[data-toggle=\"collapse\"][data-parent=\"#chat-logs\"]").removeClass("btn-primary").addClass("btn-inverse");
		}
	}).on("keyup", checkForReturn);
	$("#chat-post").on("click", postMessage);
});