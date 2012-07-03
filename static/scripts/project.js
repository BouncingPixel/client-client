var disable = function(e) {
	var self = document.getElementById( 'canFileShare' );
	if( self.checked ) {
		self.disabled = "disabled";
		self.form.submit();
	}
};

var hide = function() {
	document.getElementById("overlay").style.display = "none";
	document.body.style.overflow = "auto";
};

var settings = function(path, name) {
	document.getElementById("alert-form").action = path;
	document.getElementById("alert-name").innerHTML = unescape(name);
	document.getElementById("overlay").style.display = "block";
	$(document.body).scrollTop("0px");
	document.body.style.overflow = "hidden";
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
	xmlhttp.upload.onprogress = function() {
		console.log("status received");
		bar.style.width = "50%";
	};
	xmlhttp.onload = function() {
		bar.style.width = "100%";
		location.reload(true);
	};
	xmlhttp.onerror = xmlhttp.onabort = function(err) {
		console.log(err);
		document.getElementById("overlay").style.display = "none";
		div.style.display = "none";
		span.style.display = "inline";
		bar.style.width = "0%";
		document.body.style.overflow = "auto";
	};
	xmlhttp.send(params);
	return false;
};