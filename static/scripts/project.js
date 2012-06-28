var disable = function( e ) {
	var self = document.getElementById( 'canFileShare' );
	if( self.checked ) {
		self.disabled = "disabled";
		self.form.submit();
	}
};

var hide = function() {
	document.getElementById("overlay").style.display = "none";
};

var settings = function(path) {
	document.getElementById("alert-form").action = path;
	var overlay = document.getElementById("overlay");
	overlay.style.display = "block";
	overlay.style.backgroundColor = "hsla(0,100%,100%,0.6)";
};

var remove = function(path) {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", path, true);
	xmlhttp.send();
};