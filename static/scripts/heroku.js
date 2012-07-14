var loadLog = function () {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", location.pathname+"/logs?log="+escape(log), true);
	xmlhttp.addEventListener("load", function (e) {
		$("#log").html(xmlhttp.responseText);
	}, false);
	xmlhttp.send();
	$("#log").attr("wrap", "off");
	$("#log").on("focus", function (e) {
		$(this).blur();
	});
	$("#log").html("Loading...");
};

var restart = function (ps) {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", location.pathname+"/ps/restart?ps="+escape(ps), true);
	xmlhttp.addEventListener("load", function (e) {
		location.reload(true);
	});
	xmlhttp.send();
};

var stop = function (ps) {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", location.pathname+"/ps/stop?ps="+escape(ps), true);
	xmlhttp.addEventListener("load", function (e) {
		location.reload(true);
	});
	xmlhttp.send();
};