var update = io.connect("/upload");

$(function() {
	try {
		update.send(document.forms["file-upload-form"].hash.value);
	} catch (err) {}
	//toggle carets
	$(".triangle").html("&#9662;");
	$(".file-stats:not(.file-header)").on("click", function () {
		$(this).children(".triangle").toggleClass("triangle-right");
	});
	$("[data-toggle='sort']").one("click.triangle", function () {
		var self = arguments.callee;
		var alt = function () {
			$(this).removeAttr("data-reverse").children(".triangle").removeClass("triangle-up");
			$("[data-toggle='sort']").removeClass("active").has("b.triangle").off("click.triangle").one("click.triangle", alt);
			$("[data-toggle='sort']:has(b.triangle-up)").off("click.triangle").one("click.triangle", self);
			$(this).addClass("active").off("click.triangle").one("click.triangle", self).trigger("sort");
		};
		$(this).attr("data-reverse", "reverse").children(".triangle").addClass("triangle-up");
		$("[data-toggle='sort']").removeClass("active").has("b.triangle").off("click.triangle").one("click.triangle", alt);
		$("[data-toggle='sort']:has(b.triangle-up)").off("click.triangle").one("click.triangle", self);
		$(this).addClass("active").off("click.triangle").one("click.triangle", alt).trigger("sort");
	}).on("sort", function () {
		var $this = $(this);
		var sort = $this.attr("data-sort");
		var reverse = $this.attr("data-reverse");
		var $files = $(".files .file-stats:not(.file-header)").detach();
		var files = $files.toArray();
		files.sort(function (file1, file2) {
			var $file1 = $(file1);
			var $file2 = $(file2);
			var self = function ($file1, $file2) {
				switch(sort) {
					case "file-name":
						var name1 = $file1.find(".file-name");
						name1 = name1.attr("data-sort");
						var name2 = $file2.find(".file-name");
						name2 = name2.attr("data-sort");
						var localeCompare = (name1.toLowerCase()).localeCompare(name2.toLowerCase());
						if(localeCompare === 0) localeCompare = name1.localeCompare(name2);
						return reverse?-localeCompare:localeCompare;
						break;
					case "file-size":
						var size1 = Number($file1.find(".file-size").attr("data-sort"));
						var size2 = Number($file2.find(".file-size").attr("data-sort"));
						return reverse?size1-size2:size2-size1;
						break;
					case "file-date":
						var date1 = new Date($file1.find(".file-date").attr("data-sort"));
						var date2 = new Date($file2.find(".file-date").attr("data-sort"));
						if(date1 > date2) return reverse?1:-1;
						if(date1 < date2) return reverse?-1:1;
						return 0;
						break;
				}
			};
			var class1 = $file1.attr("class").split(" ");
			var class2 = $file2.attr("class").split(" ");
			var i;
			for(i=0;i<class1.length;i++) {
				if(class1[i].indexOf("file0") === 0) {
					class1 = class1[i].split("_");
					break;
				}
			}
			for(i=0;i<class2.length;i++) {
				if(class2[i].indexOf("file0") === 0) {
					class2 = class2[i].split("_");
					break;
				}
			}
			if(class1.length === class2.length && class1.join("_") === class2.join("_")) return self($file1, $file2);
			for(i=0;i<class1.length&&i<class2.length;i++) {
				if(class1[i] === class2[i]) continue;
				break;
			}
			if(i===class1.length&&i===class2.length) return self($file1, $file2);
			if(i===class1.length) {
				class2 = class2.slice(0,i+1).join("_");
				var localeCompare = self($file1, $files.filter("[data-open='.files ."+class2+"']"));
				if(localeCompare === 0) return -1;
				return localeCompare;
			}
			if(i===class2.length) {
				class1 = class1.slice(0,i+1).join("_");
				var localeCompare = self($files.filter("[data-open='.files ."+class1+"']"), $file2);
				if(localeCompare === 0) return 1;
				return localeCompare;
			}
			class1 = class1.slice(0,i+1).join("_");
			class2 = class2.slice(0,i+1).join("_");
			return self($files.filter("[data-open='.files ."+class1+"']"), $files.filter("[data-open='.files ."+class2+"']"));
		});
		$(files).appendTo($(".files"));
	});
	$(".file-name[data-toggle='sort']").trigger("click").trigger("click");
	//enable tooltips
	$("[rel='tooltip']").tooltip();
	//override collapse plugin
	$(".files [data-toggle='collapse']").off("click").on("click", function (e) {
		if(e.cancelable) {
			e.preventDefault();
			e.stopPropagation();
		}
		var $this = $(this);
		if($this.css("display")==="none") return; //ignore 'click'
		var target = $($($this.attr("data-open"))[0]).css("display")==="none"?"data-open":"data-close";
		if(target === "data-open") {
			$this.find(".triangle").removeClass("triangle-right");
		} else if(target === "data-close") {
			$this.find(".triangle").addClass("triangle-right");
		}
		$($this.attr(target)).each(function (index) {
			var $this = $(this);
			if(target === "data-open") {
				$this.css("display", "table-row");
			} else if(target === "data-close") {
				$this.css("display", "none");
			}
		});
		return false;
	}).trigger("click");
	$(".files .file-stats:not([data-toggle='collapse'], .file-header)").on("click", function (e) {
		var $this = $(this);
		settings($this.attr("data-path"), $this.find(".name-text").attr("data-content"));
	});
	$("input[type='file']").on("change", function () {
		setTimeout(function () {
			$("#directory").modal();
		}, 500);
	});
	$(".directory .file-stats").on("click", function () {
		$(".directory .file-stats").removeClass("active");
		$(this).addClass("active");
	});
	$(".directory .file-stats:first-child").trigger("click");
	$("#cwd").on("change", function () {
		$(".directory .file-stats").removeClass("active");
	});
	$("#btnDir").on("click", function () {
		$("input[name='path']").val($("#cwd").val());
	});
});

var cd = function(path) {
	$("#cwd").val(path);
};

var disable = function(e) {
	var self = document.getElementById( 'canFileShare' );
	if( self.checked ) {
		self.disabled = "disabled";
		self.form.submit();
	}
};

var settings = function(path, name) {
	document.getElementById("alert-name").innerHTML = name;
	var file = name.split(".");
	file.pop();
	file = file.join(".");
	document.getElementById("alert-name-input").value = file;
	$(".alert-path-value").val(path);
	var form = $("#download-form"),
			action = form.attr("action");
	form.attr("action", action.split("/").slice(0,4).join("/")+"/"+encodeURIComponent(file));
	$(document.getElementById("overlay")).modal();
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
			params += encodeURIComponent(elems[i].name);
			params += "=";
			params += encodeURIComponent(elems[i].value);
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
	update.on("upload", function (widthStr) {
		bar.style.width = widthStr;
	});
	update.on("send", function (widthStr) {
		bar2.style.width = widthStr;
	});
	update.on("done", function () {
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