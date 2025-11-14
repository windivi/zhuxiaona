function mdclicklink() {
	var select = document.getElementById('mdclicklink');
	var mdclicklink = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'mdclicklink': mdclicklink});
}
function ctrlmdclicklink() {
	var select = document.getElementById('ctrlmdclicklink');
	var ctrlmdclicklink = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'ctrlmdclicklink': ctrlmdclicklink});
}
function shiftmdclicklink() {
	var select = document.getElementById('shiftmdclicklink');
	var shiftmdclicklink = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'shiftmdclicklink': shiftmdclicklink});
}
function mousecombination1() {
	var select = document.getElementById('mousecombination1');
	var mousecombination1 = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'mousecombination1': mousecombination1});
}
function mousecombination2() {
	var select = document.getElementById('mousecombination2');
	var mousecombination2 = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'mousecombination2': mousecombination2});
}
function mousecombination3() {
	var select = document.getElementById('mousecombination3');
	var mousecombination3 = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'mousecombination3': mousecombination3});
}
function quality() {
	var select = document.getElementById('quality');
	var quality = select.children[select.selectedIndex].value;
	chrome.storage.local.set({'quality': quality});
}
function mdclickpage() {
	if (document.getElementById('mdclickpage').checked) {
		chrome.storage.local.set({'mdclickpage': true});
	} else {
		chrome.storage.local.set({'mdclickpage': false});
	}
}
function ytbuttons() {
	if (document.getElementById('ytbuttons').checked) {
		chrome.storage.local.set({'ytbuttons': true});
	} else {
		chrome.storage.local.set({'ytbuttons': false});
	}
}
function darkStyle() {
	if (document.getElementById('darkStyle').checked) {
		chrome.storage.local.set({'darkStyle': true});
	} else {
		chrome.storage.local.set({'darkStyle': false});
	}
}
function timeSync() {
	if (document.getElementById('timeSync').checked) {
		chrome.storage.local.set({'timeSync': true});
	} else {
		chrome.storage.local.set({'timeSync': false});
	}
}
function vpause() {
	if (document.getElementById('vpause').checked) {
		chrome.storage.local.set({'vpause': true});
	} else {
		chrome.storage.local.set({'vpause': false});
	}
}
function pauseAndPlay() {
	if (document.getElementById('pauseAndPlay').checked) {
		chrome.storage.local.set({'pauseAndPlay': true});
	} else {
		chrome.storage.local.set({'pauseAndPlay': false});
	}
}
function anyLinkOpen() {
	if (document.getElementById('anyLinkOpen').checked) {
        chrome.storage.local.set({'anyLinkOpen': true});
		chrome.runtime.sendMessage({anyLinkOpen: true});
		document.getElementById('linkYoutubePlay').disabled=true;
    } else {
        chrome.storage.local.set({'anyLinkOpen': false});
		chrome.runtime.sendMessage({anyLinkOpen: false});
		document.getElementById('linkYoutubePlay').disabled=false;
    }
}
function linkYoutubePlay() {
	if (document.getElementById('linkYoutubePlay').checked) {
        chrome.storage.local.set({'linkYoutubePlay': true});
		chrome.runtime.sendMessage({linkYoutubePlay: true});
    } else {
        chrome.storage.local.set({'linkYoutubePlay': false});
		chrome.runtime.sendMessage({linkYoutubePlay: false});
    }
}
function anyLinkAdd() {
	if (document.getElementById('anyLinkAdd').checked) {
        chrome.storage.local.set({'anyLinkAdd': true});
		chrome.runtime.sendMessage({anyLinkAdd: true});
		document.getElementById('linkYoutubeAdd').disabled=true;
    } else {
        chrome.storage.local.set({'anyLinkAdd': false});
		chrome.runtime.sendMessage({anyLinkAdd: false});
		document.getElementById('linkYoutubeAdd').disabled=false;
    }
}
function linkYoutubeAdd() {
	if (document.getElementById('linkYoutubeAdd').checked) {
        chrome.storage.local.set({'linkYoutubeAdd': true});
		chrome.runtime.sendMessage({linkYoutubeAdd: true});
    } else {
        chrome.storage.local.set({'linkYoutubeAdd': false});
		chrome.runtime.sendMessage({linkYoutubeAdd: false});
    }
}
// function pageYoutubeAdd() {
// 	if (document.getElementById('pageYoutubeAdd').checked) {
//         chrome.storage.local.set({'pageYoutubeAdd': true});
// 		chrome.runtime.sendMessage({pageYoutubeAdd: true});
//     } else {
//         chrome.storage.local.set({'pageYoutubeAdd': false});
// 		chrome.runtime.sendMessage({pageYoutubeAdd: false});
//     }
// }
function clickVideoMode() {
	var radios = document.getElementsByName('clickVideoMode');
	for (var i = 0; i < radios.length; i++) {
		if (radios[i].checked) {
			chrome.storage.local.set({'clickVideoMode': i});
			break;
		}
	}
}
function restore_options() {
	
	chrome.storage.local.get('clickVideoMode', function(result) {
		var radios = document.getElementsByName('clickVideoMode');
		radios[result.clickVideoMode].checked = true;
	});
	/*for (var i = 0, length = radios.length; i < length; i++) {
		if (radios[i].checked) {
		radios[i].checked
        break;
		}
	}*/
	
	chrome.storage.local.get('mdclickpage', function(result) {
		if (result.mdclickpage == true) 
			document.getElementById('mdclickpage').checked=true;
		else document.getElementById('mdclickpage').checked=false;
	});
	
	chrome.storage.local.get('vpause', function(result) {
		if (result.vpause == true)
			document.getElementById('vpause').checked=true;
		else document.getElementById('vpause').checked=false; 
	});
	
	chrome.storage.local.get('pauseAndPlay', function(result) {
		if (result.pauseAndPlay == true)
			document.getElementById('pauseAndPlay').checked=true;
		else document.getElementById('pauseAndPlay').checked=false; 
	});
	
	chrome.storage.local.get('ytbuttons', function(result) {
		if (result.ytbuttons == true) {
			document.getElementById('ytbuttons').checked=true;
		} else {
			document.getElementById('ytbuttons').checked=false;
		}
	});
	
	chrome.storage.local.get('darkStyle', function(result) {
		if (result.darkStyle == true) 
			document.getElementById('darkStyle').checked=true;
		else document.getElementById('darkStyle').checked=false;
	});
	
	chrome.storage.local.get('timeSync', function(result) {
		if (result.timeSync == true) 
			document.getElementById('timeSync').checked=true;
		else document.getElementById('timeSync').checked=false;
	});
	
	chrome.storage.local.get('linkYoutubePlay', function(result) {
		if (result.linkYoutubePlay == true) 
			document.getElementById('linkYoutubePlay').checked=true;
		else document.getElementById('linkYoutubePlay').checked=false;
	});
	
	chrome.storage.local.get('linkYoutubeAdd', function(result) {
		if (result.linkYoutubeAdd == true) 
			document.getElementById('linkYoutubeAdd').checked=true;
		else document.getElementById('linkYoutubeAdd').checked=false;
		if (result.linkYoutubeAdd !== true && result.linkYoutubeAdd !== false)
			chrome.storage.local.set({'linkYoutubeAdd': false});
	});
	
	chrome.storage.local.get('anyLinkAdd', function(result) {
		if (result.anyLinkAdd == true) {
			document.getElementById('anyLinkAdd').checked=true;
			document.getElementById('linkYoutubeAdd').disabled=true;
		}
		else document.getElementById('anyLinkAdd').checked=false;
		if (result.anyLinkAdd !== true && result.anyLinkAdd !== false)
			chrome.storage.local.set({'anyLinkAdd': false});
	});
	
	chrome.storage.local.get('anyLinkOpen', function(result) {
		if (result.anyLinkOpen == true) {
			document.getElementById('anyLinkOpen').checked=true;
			document.getElementById('linkYoutubePlay').disabled=true;
		}
		else document.getElementById('anyLinkOpen').checked=false;
		if (result.anyLinkOpen !== true && result.anyLinkOpen !== false)
			chrome.storage.local.set({'anyLinkOpen': false});
	});

	//chrome.storage.local.get('pageYoutubeAdd', function(result) {
	//	if (result.pageYoutubeAdd == true) 
	//		document.getElementById('pageYoutubeAdd').checked=true;
	//	else document.getElementById('pageYoutubeAdd').checked=false;
	//});
	
	chrome.storage.local.get('mdclicklink', function(result) {
		var mdclicklink = result.mdclicklink;
		for (var i = 0; i < document.getElementById('mdclicklink').children.length; i++) {
			var child = document.getElementById('mdclicklink').children[i];
			if (child.value == mdclicklink) {
				child.selected = true;
				break;
			}
		}
	});
	chrome.storage.local.get('ctrlmdclicklink', function(result) {
		var ctrlmdclicklink = result.ctrlmdclicklink;
		for (var i = 0; i < document.getElementById('ctrlmdclicklink').children.length; i++) {
			var child = document.getElementById('ctrlmdclicklink').children[i];
			if (child.value == ctrlmdclicklink) {
				child.selected = true;
				break;
			}
		}
	});
	chrome.storage.local.get('shiftmdclicklink', function(result) {
		var shiftmdclicklink = result.shiftmdclicklink;
		for (var i = 0; i < document.getElementById('shiftmdclicklink').children.length; i++) {
			var child = document.getElementById('shiftmdclicklink').children[i];
			if (child.value == shiftmdclicklink) {
				child.selected = true;
				break;
			}
		}
	});
	chrome.storage.local.get('mousecombination1', function(result) {
		var mousecombination1 = result.mousecombination1;
		for (var i = 0; i < document.getElementById('mousecombination1').children.length; i++) {
			var child = document.getElementById('mousecombination1').children[i];
			if (child.value == mousecombination1) {
				child.selected = true;
				break;
			}
		}
	});
	chrome.storage.local.get('mousecombination2', function(result) {
		var mousecombination2 = result.mousecombination2;
		for (var i = 0; i < document.getElementById('mousecombination2').children.length; i++) {
			var child = document.getElementById('mousecombination2').children[i];
			if (child.value == mousecombination2) {
				child.selected = true;
				break;
			}
		}
	});
	chrome.storage.local.get('mousecombination3', function(result) {
		var mousecombination3 = result.mousecombination3;
		for (var i = 0; i < document.getElementById('mousecombination3').children.length; i++) {
			var child = document.getElementById('mousecombination3').children[i];
			if (child.value == mousecombination3) {
				child.selected = true;
				break;
			}
		}
	});
	chrome.storage.local.get('quality', function(result) {
		var quality = result.quality;
		if (quality) {
			for (var i = 0; i < document.getElementById('quality').children.length; i++) {
				var child = document.getElementById('quality').children[i];
				if (child.value == quality) {
					child.selected = true;
					break;
				}
			}
		}
	});
	if (chrome.extension.getViews({ type: "popup" }).length > 0) {
		var links = document.getElementsByTagName("a");
		for (var i = 0; i < links.length; i++) {
		    (function () {
		        var ln = links[i];
		        var location = ln.href;
		        ln.onclick = function () {
		            chrome.tabs.create({active: true, url: location});
		        };
		    })();
		}
	}
}
function localizeHtmlPage() {
	var objects = document.getElementsByTagName('html');
    for (var j = 0; j < objects.length; j++) {
        var obj = objects[j];

        var valStrH = obj.innerHTML.toString();
        var valNewH = valStrH.replace(/__MSG_(\w+)__/g, function(match, v1)
        {
            return v1 ? chrome.i18n.getMessage(v1) : "";
        });

        if(valNewH != valStrH)
        {
            obj.innerHTML = valNewH;
        }
    }
}
function hasClass(elem, className) {
    return elem.className.split(' ').indexOf(className) > -1;
}
localizeHtmlPage();
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#mdclicklink').addEventListener('click',mdclicklink);
document.querySelector('#ctrlmdclicklink').addEventListener('click',ctrlmdclicklink);
document.querySelector('#shiftmdclicklink').addEventListener('click',shiftmdclicklink);
document.querySelector('#mousecombination1').addEventListener('click',mousecombination1);
document.querySelector('#mousecombination2').addEventListener('click',mousecombination2);
document.querySelector('#mousecombination3').addEventListener('click',mousecombination3);
document.querySelector('#quality').addEventListener('click',quality);
document.querySelector('#mdclickpage').addEventListener('click',mdclickpage);
document.querySelector('#vpause').addEventListener('click',vpause);
document.querySelector('#pauseAndPlay').addEventListener('click',pauseAndPlay);
document.querySelector('#ytbuttons').addEventListener('click',ytbuttons);
document.querySelector('#darkStyle').addEventListener('click',darkStyle);
document.querySelector('#timeSync').addEventListener('click',timeSync);
document.querySelector('#linkYoutubePlay').addEventListener('click',linkYoutubePlay);
document.querySelector('#linkYoutubeAdd').addEventListener('click',linkYoutubeAdd);
document.querySelector('#anyLinkOpen').addEventListener('click',anyLinkOpen);
document.querySelector('#anyLinkAdd').addEventListener('click',anyLinkAdd);
//document.querySelector('#pageYoutubeAdd').addEventListener('click',pageYoutubeAdd);
document.querySelector('#checkElements').addEventListener('click',clickVideoMode);