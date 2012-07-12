var loadLog = function () {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", "?log="+escape(log), true);
	xmlhttp.addEventListener("load", function (e) {
		$("#log").html(xmlhttp.responseText);
	}, false);
	xmlhttp.send();
	$("#log").html("Loading...");
};