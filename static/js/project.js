var socket = io.connect();

$(function() {
	try {
		socket.send(document.forms["file-upload-form"].hash.value);
	} catch (err) {}
	//automatically show projectlist in contents partial for project page
	$("#projectlist").addClass("in");
	//toggle caret from horizontal to vertical and back
	$(".div-tab").on("click", function () {
		$(this).children(".triangle").toggleClass("triangle-right");
	});
	$("div#sortbar a.dropdown").one("click.triangle", function () {
		var self = arguments.callee;
		var alt = function () {
			$(this).children(".triangle").removeClass("triangle-up");
			$("div#sortbar a.dropdown:has(b.triangle)").off("click.triangle").one("click.triangle", alt);
			$("div#sortbar a.dropdown:has(b.triangle-up)").off("click.triangle").one("click.triangle", self);
			$(this).off("click.triangle").one("click.triangle", self).removeAttr("data-reverse");
		};
		$(this).children(".triangle").addClass("triangle-up");
		$("div#sortbar a.dropdown:has(b.triangle)").off("click.triangle").one("click.triangle", alt);
		$("div#sortbar a.dropdown:has(b.triangle-up)").off("click.triangle").one("click.triangle", self);
		$(this).off("click.triangle").one("click.triangle", alt).attr("data-reverse", "reverse");
	});
	//enable tooltips
	$(".div-striped .btn").tooltip();
	//prevent inset buttons from toggling the collapse plugin
	$(".div-tab div.btn-group").on("click", function (e) {
		if(e.cancelable) e.preventDefault();
		return false;
	});
	//re-enable inset a.btn elements due to above cancelation
	$(".div-tab div.btn-group a.btn").on("click", function (e) {
		location.href = $(this).attr("href");
	});
	//dynamically alter css of the .div-striped element
	$("div.div-striped div.div-row").each(function (index, el) {
		if(index%2==1) {
			$(el).addClass("striped-row");
		} else {
			$(el).removeClass("striped-row");
		}
	//prevent last div from overlapping on the .div-striped border-radius
	}).last().addClass("last");
	$(".row-fluid.collapse").on("show", function () {
		$(this).addClass("div-row");
		$("div.div-striped div.div-row").each(function (index, el) {
			if(index%2==1) {
				$(el).addClass("striped-row");
			} else {
				$(el).removeClass("striped-row");
			}
	//prevent last div from overlapping on the .div-striped border-radius
		}).removeClass("last").last().addClass("last");
	}).on("hide", function () {
		$("div.div-striped div.div-row.last").removeClass("last");
		$(this).removeClass("div-row");
		$("div.div-striped div.div-row").each(function (index, el) {
			if(index%2==1) {
				$(el).addClass("striped-row");
			} else {
				$(el).removeClass("striped-row");
			}
	//prevent last div from overlapping on the .div-striped border-radius
		}).last().addClass("last");
	});
	//enable sorting by various data-types
	$("div#sortbar a[data-toggle='sort']").one("click", function (e) {
		if(e.cancelable) e.preventDefault();
		$("div.btn-group a[data-toggle='sort']").removeClass("active");
		$(this).addClass("active");
		var attr = "[data-sort='"+($(this).attr("data-sort"))+"']";
		var type = $(this).attr("data-class");
		var reverse = !!$(this).attr("data-reverse");
		var arr = $("div.div-striped > div").detach().toArray();
		var $arr = $(arr);
		arr.sort(function (a, b) {
			var $a = $(a);
			var $b = $(b);
			var fileClassA;
			var tabA;
			if($a.hasClass("div-tab")) {
				fileClassA = (/file[0-9]+/).exec($a.attr("data-target"))[0];
				tabA = true;
			} else {
				fileClassA = (/file[0-9]+/).exec($a.attr("class"))[0];
				tabA = false;
			}
			var fileClassB;
			var tabB;
			if($b.hasClass("div-tab")) {
				fileClassB = (/file[0-9]+/).exec($b.attr("data-target"))[0];
				tabB = true;
			} else {
				fileClassB = (/file[0-9]+/).exec($b.attr("class"))[0];
				tabB = false;
			}
			if(fileClassA === fileClassB) {
				if(tabA) return (reverse?1:-1);
				if(tabB) return (reverse?-1:1);
				var propA = $a.find("a[data-toggle='sort']").attr("data-sort");
				var propB = $b.find("a[data-toggle='sort']").attr("data-sort");
				switch (propA) {
					case "Date Modified":
						return (reverse?1:-1);
					case "Content-Type":
						switch (propB) {
							case "Date Modified":
								return (reverse?-1:1);
							case "Size":
								return (reverse?1:-1);
						}
					case "Size":
						return (reverse?-1:1);
				}
			}
			var sortA = $arr.filter("."+fileClassA).add($arr.filter("[data-target='."+fileClassA+"']")).find("a"+attr).attr("data-value");
			var sortB = $arr.filter("."+fileClassB).add($arr.filter("[data-target='."+fileClassB+"']")).find("a"+attr).attr("data-value");
			switch (type) {
				case "Date":
					sortA = new Date(sortA).getTime();
					sortB = new Date(sortB).getTime();
				case "Number":
					sortA = Number(sortA);
					sortB = Number(sortB);
					if(sortB!==sortA) return sortB-sortA;
					var fileIndexA = Number(fileClassA.substr(4));
					var fileIndexB = Number(fileClassB.substr(4));
					return (reverse?fileIndexB-fileIndexA:fileIndexA-fileIndexB);
				case "String":
					if(sortA.toLowerCase().localeCompare(sortB.toLowerCase())!==0) {
						return sortA.toLowerCase().localeCompare(sortB.toLowerCase())*(reverse?-1:1);
					}
					var fileIndexA = Number(fileClassA.substr(4));
					var fileIndexB = Number(fileClassB.substr(4));
					return (reverse?fileIndexB-fileIndexA:fileIndexA-fileIndexB);
			}
		}).forEach(function (elem) {
			$("div.div-striped").append(elem);
		});
		$("div.div-striped div.div-row").each(function (index, el) {
			if(index%2==1) {
				$(el).addClass("striped-row");
			} else {
				$(el).removeClass("striped-row");
			}
	//prevent last div from overlapping on the .div-striped border-radius
		}).removeClass("last").last().addClass("last");
		$(this).one("click", arguments.callee);
		return false;
	});
	//sort initially by date
	$("div.btn-group a[data-sort='Date Modified']").trigger("click").trigger("click");
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