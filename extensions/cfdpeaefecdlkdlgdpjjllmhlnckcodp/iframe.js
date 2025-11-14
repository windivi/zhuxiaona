(function() {
	addEventListener('message', function(event) {
		if (event.data.fromExtension === true) {
			var iframe = document.getElementsByTagName('iframe')[0];
			if (iframe && (iframe.contentWindow === event.source)) {
				iframe.contentWindow.postMessage("youtube", "*");
			}	
		}
	});
})();