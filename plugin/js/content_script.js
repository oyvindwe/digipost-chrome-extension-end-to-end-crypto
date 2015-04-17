"use strict";

(function loadOverrideScript() {
	console.debug("Loading override script into the Digipost DOM. This allows it to hook into Digiposts frontend display logic.");
	var s = document.createElement('script');
	s.src = chrome.extension.getURL('js/override.js');
	s.onload = function () {
		this.parentNode.removeChild(this);
	};
	(document.head || document.documentElement).appendChild(s);
})();


function download(url) {
	console.time("Download");
	var xhr = new XMLHttpRequest();
	xhr.responseType = "arraybuffer";
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
			console.timeEnd("Download");
			if (xhr.status !== 200) {
				return failed('Got wrong response ' + xhr.status);
			}
			var contentType = xhr.getResponseHeader('content-type');
			decrypt(xhr.response, contentType);
		}
	};
	xhr.open("GET", url, true);
	xhr.send();
}

function decrypt(data, contentType) {
	console.time("Decrypt");
	chrome.runtime.sendMessage({
		to:"background", 
		message: "decrypt", 
		data: forge.util.binary.base64.encode(new Uint8Array(data)) 
	}, function(response) {
		console.timeEnd("Decrypt");
		if (response.error) {
			return emit('decryption-failed', { error: response.error });
		}
		handleDecrypted(stringToUint8Array(response.data), contentType);
	});
}

function handleDecrypted(data, contentType) {
	if (contentType.indexOf('html') > 0) {
		data = sanitize_html(data);
	}
	var blobUrl = createBlob(data, contentType);

	emit('decrypted', { 
		url: blobUrl, 
		contentType: contentType 
	});
}

function emit(event, data) {
	document.dispatchEvent(new CustomEvent(event, { detail : data }));	
}

function sanitize_html(data) {
	var bom = [0xef, 0xbb, 0xbf];
	if (data[0] !== bom[0] || data[1] !== bom[1] || data[2] !== bom[2]) {
		data = bom.concat(data);
	}
	var html = String.fromCharCode.apply(this, data);
	var purified = DOMPurify.sanitize(html, {WHOLE_DOCUMENT: true});
	return stringToUint8Array(purified);
}

function createBlob(decrypted, contentType) {
	var blob = new Blob( [ new Uint8Array(decrypted) ], { type: contentType } );
	return (window.URL || window.webkitURL).createObjectURL(blob);
}

function stringToUint8Array(str) {
	var arr = new Uint8Array(str.length);
	var j = str.length;
	for(var i = 0; i < j ; ++i){
	  arr[i] = str.charCodeAt(i);
	}
	return arr;
}

function failed(message) {
	document.dispatchEvent(new CustomEvent('failed', { detail : message } ));
}

document.addEventListener('start', function(e, x){
	download(e.detail);
});
