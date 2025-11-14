'use strict';

var ff = false;

var devMode = !('update_url' in chrome.runtime.getManifest());

if (devMode) console.log("PPYoutube content script");

var timeSync, mousecombination1, mousecombination2, mousecombination3, mdclickpage, mdclicklink, ctrlmdclicklink, shiftmdclicklink;
chrome.storage.local.get('timeSync', function(result) {
	timeSync = result.timeSync;
});
chrome.storage.local.get('mousecombination1', function(result) {
	mousecombination1 = result.mousecombination1;
	if (!mousecombination1) {
		mousecombination1 = 1;
		chrome.storage.local.set({'mousecombination1': 1});
	}
});
chrome.storage.local.get('mousecombination2', function(result) {
	mousecombination2 = result.mousecombination2;
	if (!mousecombination2) {
		mousecombination2 = 1;
		chrome.storage.local.set({'mousecombination2': 1});
	}
});
chrome.storage.local.get('mousecombination3', function(result) {
	mousecombination3 = result.mousecombination3;
	if (!mousecombination3) {
		mousecombination3 = 1;
		chrome.storage.local.set({'mousecombination3': 1});
	}
});
chrome.storage.local.get('mdclickpage', function(result) {
	mdclickpage = result.mdclickpage;
});
chrome.storage.local.get('mdclicklink', function(result) {
	mdclicklink = result.mdclicklink;
});
chrome.storage.local.get('ctrlmdclicklink', function(result) {
	ctrlmdclicklink = result.ctrlmdclicklink;
});
chrome.storage.local.get('shiftmdclicklink', function(result) {
	shiftmdclicklink = result.shiftmdclicklink;
	MiddleClicks();
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
	if ('timeSync' in changes) timeSync = changes.timeSync.newValue;
	if ('mousecombination1' in changes) { 
		mousecombination1 = changes.mousecombination1.newValue;
	}
	if ('mousecombination2' in changes) { 
		mousecombination2 = changes.mousecombination2.newValue;
	}
	if ('mousecombination3' in changes) { 
		mousecombination3 = changes.mousecombination3.newValue;
	}
	if ('mdclickpage' in changes) { 
		mdclickpage = changes.mdclickpage.newValue;
	}
	if ('mdclicklink' in changes) { 
		mdclicklink = changes.mdclicklink.newValue;
	}
	if ('ctrlmdclicklink' in changes) { 
		ctrlmdclicklink = changes.ctrlmdclicklink.newValue;
	}
	if ('shiftmdclicklink' in changes) { 
		shiftmdclicklink = changes.shiftmdclicklink.newValue;
	}
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.action == "playContextSync") {
		chrome.runtime.sendMessage({action: "play", redirect: playSync(request.redirect)});
	} else if (request.action == "SetPauseAndPlay") {
		var evt = document.createEvent('Event');
		evt.initEvent('SetPauseAndPlay', true, false);
		document.dispatchEvent(evt);
	}
});

if (window.location.href.match(/twitch.tv/i)) {
	MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
	var observer = new MutationObserver(function(mutations, observer) {
		if (document.getElementById("potplayer_button") == null) {
			var cont = document.querySelectorAll("*[class^=\"tw-flex tw-overflow-hidden tw-pd-r-1\"]");
			if (cont.length > 0) {
				cont = cont[0]
				if (cont.childNodes.length == 0) return;
				var childEl = cont.childNodes[0];
				var playerButton = document.createElement("button");
				playerButton.id = "potplayer_button";
				playerButton.setAttribute("class", "yt-ppbuttonBlack");
				playerButton.textContent = chrome.i18n.getMessage('buttonPlay');
				playerButton.addEventListener("click", function() {
					chrome.storage.local.get('twitchClicked', function(result) {
						if (!result.twitchClicked) {
							chrome.storage.local.set({'twitchClicked': true});
							window.open('https://github.com/23rd/TwitchPotPlayer', '_blank');
						} else {
							chrome.runtime.sendMessage({action: "play", redirect: window.location.href});
						}
					});
				});
				var playerLink = document.createElement("div");
				playerButton.style.marginRight = "17px";
				playerLink.setAttribute("style", "display: flex;justify-content: center;align-items: center;");
				playerLink.appendChild(playerButton);
				cont.insertBefore(playerLink, childEl);
			}
		}
	});
	observer.observe(document, {
		subtree: true,
		attributes: true
	});
}

function YTPlayerAutoPause() {
	var pauseAndPlay;
	chrome.storage.local.get('pauseAndPlay', function(result) {
		pauseAndPlay = result.pauseAndPlay;
		window.localStorage['pauseAndPlay'] = pauseAndPlay;
	});
	chrome.storage.local.get('vpause', function(result) {
		if (!pauseAndPlay && !result.vpause) {
			return;
		}
		window.localStorage['vpause'] = result.vpause;
		if (window.location.href.match(/youtube.com/i)) {
			//window.addEventListener("load", function (e) {
  //videoElements = document.querySelectorAll("video");
  //alert("" + videoElements.length);
				//for (i = 0; i < videoElements.length; i++) {
				//	videoElements[i].pause();
				//}
			//});			
			
			var s = document.createElement('script');
			s.src = chrome.runtime.getURL('autopause.js');
			
			var timerPlayerCheck = setInterval(function() {
				if (document.getElementById("movie_player") != null) {
					clearInterval(timerPlayerCheck);
					(document.head||document.documentElement).appendChild(s);
					s.parentNode.removeChild(s);
					return;
				}
			}, 350);
		}
	});
}

function isYoutubeLink(url) {
	return url.match(/^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/) || url.match(/youtube.com\/playlist/i) || url.match(/gaming.youtube\.com/i) || url.match(/music.youtube.com\/watch/i);
}
		
function playSync(url) {

	var urlSplit = url.split("watch?v=");

	if (timeSync && isYoutubeLink(url) && urlSplit.length > 1 
		&& document.location.href.includes(urlSplit[1])) {
		try {
			var str = document.getElementsByClassName("ytp-time-current")[0].textContent;
			var p = str.split(':'),
			s = 0, m = 1;
			while (p.length > 0) {
				s += m * parseInt(p.pop(), 10);
				m *= 60;
			}
			return url + "?t=" + s;
		} catch(err) {
			return url;
		}
	} else {
		return url;
	}
}
		
function Youtube() {
	var clickVideoMode = 0;
	function clickVideo() {
		var clickEvent;
		if (clickVideoMode == 1) {
			clickEvent = "contextmenu";
		} else {
			clickEvent = "click";
		}
		var videoPlayer = document.getElementsByClassName('html5-main-video')[0];
		if (videoPlayer) {
			videoPlayer.addEventListener(clickEvent, function(e) {
				e.stopPropagation();
				e.preventDefault();
				chrome.runtime.sendMessage({action: "play", redirect: playSync(window.location.href)});   
			});
		}
	}
	if (window == top && document.location.href.search(/youtube\.com/i) != -1) {
		chrome.storage.local.get('clickVideoMode', function(result) {
			clickVideoMode = result.clickVideoMode;
			if (clickVideoMode != 0)
				clickVideo();
		});
		var ytbuttons, darkStyle;
		chrome.storage.local.get('ytbuttons', function(result) {
			ytbuttons = result.ytbuttons;
		});
		chrome.storage.local.get('darkStyle', function(result) {
			darkStyle = result.darkStyle;
		});
		chrome.storage.onChanged.addListener(function(changes, namespace) {
			if ('ytbuttons' in changes) ytbuttons = changes.ytbuttons.newValue;
			if ('darkStyle' in changes) darkStyle = changes.darkStyle.newValue;
			if ('clickVideoMode' in changes) clickVideoMode = changes.clickVideoMode.newValue;
		})
		var container; var newYoutube = false;
		var ytButtonStyle = "yt-ppbutton";
		var timer = setInterval(function() {
			try {
				if (document.getElementById("potplayer_button") != null) {
					return;
				}
				if (document.location.href.search(/gaming.youtube\.com/i) != -1) {
					container = document.getElementsByClassName('byline style-scope ytg-watch-footer')[0];
					ytButtonStyle = "yt-ppbuttonBlack";
				} else if (document.getElementById('watch7-subscription-container') && document.getElementById('watch7-headline')) {  // old Youtube UI
					container = document.getElementById('watch7-subscription-container');
					if (darkStyle == true)
						ytButtonStyle = "yt-ppbuttonBlack";
				} else if (document.getElementById("bottom-row")) { // new Youtube UI 11.10.2025
					newYoutube = true;
					container = document.getElementById("bottom-row");
					if (darkStyle == true)
						ytButtonStyle = "yt-ppbuttonBlack";
				} else if (document.getElementById("description-and-actions")) { // new new Youtube UI
					newYoutube = true;
					container = document.getElementById("description-and-actions");
					if (darkStyle == true)
						ytButtonStyle = "yt-ppbuttonBlack";
				}
				if (container != null && ytbuttons) {
					var playerButtonsContainer = document.createElement("div");
					var playerButton = document.createElement("button");
					playerButton.id = "potplayer_button";
					playerButton.setAttribute("class", ytButtonStyle);
					playerButton.setAttribute("style", "margin-top:8px;");
					playerButton.textContent = chrome.i18n.getMessage('buttonPlay');
					var playerLink = document.createElement("a");
					playerLink.addEventListener("click", function() {
						chrome.runtime.sendMessage({action: "play", redirect: playSync(document.URL)});
					});
					playerLink.setAttribute("style", "text-decoration: none;");
					playerLink.appendChild(playerButton);
					playerButtonsContainer.appendChild(playerLink);
					var playerButton = document.createElement("button");
					playerButton.id = "potplayer_button";
					playerButton.setAttribute("class", ytButtonStyle);
					playerButton.setAttribute("style", "margin-left:8px;margin-top:8px;");
					playerButton.textContent = chrome.i18n.getMessage('buttonAdd');
					var playerLink = document.createElement("a");
					playerLink.addEventListener("click", function() { 
						chrome.runtime.sendMessage({action: "add", redirect: document.URL});
					});
					playerLink.setAttribute("style", "text-decoration: none;");
					playerLink.appendChild(playerButton);
					playerButtonsContainer.appendChild(playerLink);
					
					container.parentNode.insertBefore(playerButtonsContainer, container);
				}
			} catch(err) {
				clearInterval(timer);
			}
		}, 350);
	}  
	/*chrome.storage.local.get('clickVideoMode', function(result) {
		clickVideoMode = result.clickVideoMode;
		if (clickVideoMode != 0 && window == top && document.location.href.search(/youtube\.com/i) == -1) {
			var s = document.createElement('script');
			s.src = chrome.runtime.getURL('iframe.js');
			(document.head||document.documentElement).appendChild(s);
			s.parentNode.removeChild(s);
		}
		if (clickVideoMode != 0 && window != top && document.location.href.search(/youtube\.com/i) != -1) {
			parent.postMessage({fromExtension: true}, '*');
			addEventListener('message', function(event) {
				if (event.data == "youtube") {
					clickVideo();
				}
			});
		}
	});*/
}
		
function ContextMenus() {
	chrome.storage.local.get('anyLinkOpen', function(result) {
		if (result.anyLinkOpen == true)
			chrome.runtime.sendMessage({anyLinkOpen: true});
	});
	chrome.storage.local.get('anyLinkAdd', function(result) {
		if (result.anyLinkAdd == true)
			chrome.runtime.sendMessage({anyLinkAdd: true});
	});
	chrome.storage.local.get('linkYoutubePlay', function(result) {
		if (result.linkYoutubePlay == true)
			chrome.runtime.sendMessage({linkYoutubePlay: true});
	});
	chrome.storage.local.get('linkYoutubeAdd', function(result) {
		if (result.linkYoutubeAdd == true)
			chrome.runtime.sendMessage({linkYoutubeAdd: true});
	});
}
		
function MiddleClicks() {
	function getLink(e) {
		if (e.target.hasAttribute("href"))
			return e.target.href;
		var parent = e.target.parentNode;
		while (parent != null && typeof parent.tagName != "undefined") {
			if (parent.hasAttribute("href"))
				return parent.href;
			parent = parent.parentNode;
		}
		return null;
	}
	document.addEventListener("mousedown", function(e) {
		if (mdclickpage && e.button == 1 && getLink(e) == null && (window.location.href.match(/youtube.com\/watch/i) 
			|| window.location.href.match(/youtube.com\/playlist/i) || window.location.href.match(/twitch\.tv/i))) {
			e.preventDefault();
			chrome.runtime.sendMessage({action: "play", redirect: playSync(window.location.href)});
		}
	});
	function processLink(e, combNumb) {
		var url = getLink(e);
		if (url != null && isYoutubeLink(url)) {
			var action;
			if (combNumb == 2) {
				action = ctrlmdclicklink;
			} else if (combNumb == 3) {
				action = shiftmdclicklink;
			} else if (combNumb == 1) {
				action = mdclicklink;
			}
			if (action == "play") {
				e.preventDefault();
				e.stopPropagation();
				chrome.runtime.sendMessage({action: "play", redirect: playSync(url)});
			} else if (action == "add") {
				e.preventDefault();
				e.stopPropagation();
				chrome.runtime.sendMessage({action: "add", redirect: url});
			}
		}
	}
	function ifCombSet(comb) {
		if (comb == "play" || comb == "add") return true;
		return false;
	} 
	function ifCombEqualButton(comb) {
		for (var i = 1, j = arguments.length; i < j; i++){
			if (comb == arguments[i])
				return true;
		}
		return false;
	}
	function auxClickFunc(e) {
		if (e.ctrlKey && ifCombEqualButton(mousecombination2, 1, 2)
			&& mousecombination2 == e.button) processLink(e, 2);
		else if (e.shiftKey && ifCombEqualButton(mousecombination3, 1, 2)
			&& mousecombination3 == e.button) processLink(e, 3);
		else if (ifCombEqualButton(mousecombination1, 1, 2)
			&& mousecombination1 == e.button) processLink(e, 1);
	}
	function clickFunc(e) {
		if (e.ctrlKey && ifCombEqualButton(mousecombination2, 0)
			&& mousecombination2 == e.button) processLink(e, 2);
		else if (e.shiftKey && ifCombEqualButton(mousecombination3, 0)
			&& mousecombination3 == e.button) processLink(e, 3);
		else if (ifCombEqualButton(mousecombination1, 0)
			&& mousecombination1 == e.button) processLink(e, 1);
	}
	function clickFuncFF(e) {
		if (e.ctrlKey && mousecombination2 == e.button) processLink(e, 2);
		else if (e.shiftKey && mousecombination3 == e.button) processLink(e, 3);
		else if (mousecombination1 == e.button) processLink(e, 1);
	}
	function getBrowser() {
		var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
		if(/trident/i.test(M[1])){
			tem=/\brv[ :]+(\d+)/g.exec(ua) || []; 
			return {name:'IE',version:(tem[1]||'')};
			}   
		if(M[1]==='Chrome'){
			tem=ua.match(/\bOPR|Edge\/(\d+)/)
			if(tem!=null)   {return {name:'Opera', version:tem[1]};}
			}   
		M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
		if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
		return {
			name: M[0],
			version: M[1]
		};
	}
	if (ff) {
		ff = getBrowser().version < 68;
	}
	if (ff) {
		document.addEventListener("click", clickFuncFF, true);
	} else {
		document.addEventListener("auxclick", auxClickFunc);
		document.addEventListener("click", clickFunc, true);
	}
}

YTPlayerAutoPause();
ContextMenus();
Youtube();