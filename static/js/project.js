var socket = io.connect();

$(function() {
	try {
		socket.send(document.forms["file-upload-form"].hash.value);
	} catch (err) {}
	$("#projectlist").addClass("in");
});

var disable = function(e) {
	var self = document.getElementById( 'canFileShare' );
	if( self.checked ) {
		self.disabled = "disabled";
		self.form.submit();
	}
};

var settings = function(path, name) {
	document.getElementById("alert-form").action = path;
	document.getElementById("alert-name").innerHTML = unescape(name);
	$(document.getElementById("overlay")).modal("show");
};

var sendReq = function(e) {
	if(e.cancelable) {
		e.preventDefault();
		e.target.disabled = "disabled";
	}
	var form = document.getElementById("alert-form"),
		span = document.getElementById("alert-input"),
		div = document.getElementById("alert-progress"),
		bar = document.getElementById("alert-bar"),
		elems = form.elements,
		params = "",
		xmlhttp = new XMLHttpRequest();
	span.style.display = "none";
	div.style.display = "block";
	for(var i=0;i<elems.length;i++) {
		if (elems[i].name && elems[i].value) {
			params += escape(elems[i].name);
			params += "=";
			params += escape(elems[i].value);
			params += "&";
		}
	}
	params = params.substr(0,params.length-1);
	xmlhttp.open(form.method, form.action, true);
	xmlhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
	xmlhttp.upload.onprogress = function(event) {
		if (event.lengthComputable) {
			bar.style.width = Math.round(event.loaded * 100 / event.total)+"%";
		}
	};
	xmlhttp.onload = function() {
		bar.style.width = "100%";
		location.reload(true);
	};
	xmlhttp.onerror = xmlhttp.onabort = function(err) {
		console.log(err);
		$(document.getElementById("overlay")).modal("hide");
		div.style.display = "none";
		span.style.display = "inline";
		bar.style.width = "0%";
	};
	xmlhttp.send(params);
	return false;
};

var upload = function(e) {
	if(e.cancelable) {
		e.preventDefault();
	}
	var form = document.getElementById("file-upload-form"),
		fd = new FormData(form),
		elems = form.elements,
		input = form.file,
		progress = document.getElementById("progress-bars"),
		bar = document.getElementById("upload-bar"),
		bar2 = document.getElementById("send-bar"),
		button = document.getElementById("upload-btn"),
		xmlhttp = new XMLHttpRequest();
	progress.style.width = input.style.width;
	button.style.display = "none";
	input.style.display = "none";
	progress.style.display = "block";
	socket.on("upload", function (widthStr) {
		bar.style.width = widthStr;
	});
	socket.on("send", function (widthStr) {
		bar2.style.width = widthStr;
	});
	socket.on("done", function () {
		location.reload(true);
	});
	xmlhttp.onload = function (event) {
		if(event.cancelable) {
			event.preventDefault();
		}
	};
	xmlhttp.onerror = function () {
		$(progress).addClass("progress-danger");
		$(progress).removeClass("progress-striped");
		button.style.display = "inline-block";
	};
	xmlhttp.open(form.method, form.action, true);
	xmlhttp.send(fd);
	return false;
};