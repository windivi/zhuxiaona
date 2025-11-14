var devMode = !('update_url' in chrome.runtime.getManifest());

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
        chrome.storage.local.set({'anyLinkOpen': true});
        chrome.storage.local.set({'pauseAndPlay': true});
        chrome.storage.local.set({'ytbuttons': true});
        chrome.storage.local.set({'linkYoutubePlay': true});
        chrome.storage.local.set({'clickVideoMode': 0});
        chrome.runtime.openOptionsPage();
    }
});

chrome.storage.local.get('clickVideoMode', function (result) {
    if (result.clickVideoMode == undefined) {
        chrome.storage.local.set({'clickVideoMode': 0});
    }
});

var quality;
chrome.storage.local.get('quality', function (result) {
    quality = result.quality;
});
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if ('quality' in changes) quality = changes.quality.newValue;
});

function playerProtocol(url) {
    window.open(url, '_self');
}

let potplayer_protocol_scheme = "potplayer:";

function play(url) {
    chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
        if (isYoutubeLink(url) && quality && quality != 0 && url.indexOf("list") === -1) {
            url = url + "?itag=" + quality;
        }
        if (devMode) console.log(url);
        let urlFinaly = potplayer_protocol_scheme + url;
        chrome.scripting.executeScript({target: {tabId: tabs[0].id}, func: playerProtocol, args: [urlFinaly]});
        chrome.storage.local.get('pauseAndPlay', function (result) {
            if (result.pauseAndPlay) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "SetPauseAndPlay"});
            }
        });
    });
}

function add(url) {
    chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
        let urlFinaly = potplayer_protocol_scheme + url + " /add";
        chrome.scripting.executeScript({target: {tabId: tabs[0].id}, func: playerProtocol, args: [urlFinaly]});
    });
}

function isYoutubeLink(url) {
    return url.match(/^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/) || url.match(/youtube.com\/playlist/i) || url.match(/gaming.youtube\.com/i);
}

var contextMenusListener = function (info, tab) {
    if (devMode) console.log("PPYoutube contextMenusListener " + JSON.stringify(info) + " " + new Date());
    if (info.menuItemId === "pageYoutube" || info.menuItemId === "playlistYoutube" || info.menuItemId === "pageTwitch") {
        if (info.menuItemId === "pageTwitch") {
            chrome.storage.local.get('twitchClicked', function (result) {
                if (false) {
                    chrome.storage.local.set({'twitchClicked': true});
                    chrome.tabs.create({url: 'https://github.com/23rd/TwitchPotPlayer'});
                } else {
                    chrome.tabs.sendMessage(tab.id, {action: "playContextSync", redirect: info.pageUrl});
                }
            });
        } else {
            chrome.tabs.sendMessage(tab.id, {action: "playContextSync", redirect: info.pageUrl});
        }
    } else if (info.menuItemId === "anyLinkOpen" || info.menuItemId === "linkYoutubePlay") {
        var url = getUrl(info);
        if (url) {
            if (isYoutubeLink(url)) {
                chrome.tabs.sendMessage(tab.id, {action: "playContextSync", redirect: url});
            } else {
                play(url);
            }
        }
    } else if (info.menuItemId === "anyLinkAdd" || info.menuItemId === "linkYoutubeAdd") {
        var url = getUrl(info);
        if (url) {
            add(url);
        }
    }
};

function getUrl(contextMenuInfo) {
    if (devMode) console.log("getUrl " + contextMenuInfo.linkUrl + " " + contextMenuInfo.srcUrl + " " + contextMenuInfo.selectionText)
    var url;
    if (contextMenuInfo.linkUrl) {
        url = contextMenuInfo.linkUrl;
    } else if (contextMenuInfo.srcUrl) {
        url = contextMenuInfo.srcUrl;
    } else if (contextMenuInfo.selectionText) {
        url = contextMenuInfo.selectionText;
    }
    return url;
}

chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('pageUrlPlay'),
        id: 'pageYoutube',
        contexts: ["page", "frame", "selection", "editable", "video"],
        documentUrlPatterns: ['*://*.youtube.com/watch*']
    });

    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('pageUrlPlay'),
        id: 'pageTwitch',
        contexts: ["page", "frame", "selection", "editable", "video"],
        documentUrlPatterns: ['*://*.twitch.tv/*']
    });

    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('playlistUrlPlay'),
        id: 'playlistYoutube',
        contexts: ["page", "frame", "selection", "editable", "video"],
        documentUrlPatterns: ['*://*.youtube.com/playlist*']
    });
});

var onMessageListener = function (request, sender, sendResponse) {
    if (devMode) console.log("PPYoutube onMessageListener " + JSON.stringify(request) + " " + new Date());
    if (request.action == "play") {
        play(request.redirect);
    } else if (request.action == "add") {
        add(request.redirect);
    } else if (request.anyLinkOpen == true) {
        chrome.contextMenus.remove('anyLinkOpen').catch(err => {});
        chrome.contextMenus.remove('linkYoutubePlay').catch(err => {});
        chrome.contextMenus.create({
            title: chrome.i18n.getMessage('linkOpen'),
            id: 'anyLinkOpen',
            contexts: ['link', 'selection', 'editable', 'video']
        });
    } else if (request.anyLinkOpen == false) {
        chrome.contextMenus.remove('anyLinkOpen').catch(err => {});
        chrome.contextMenus.remove('linkYoutubePlay').catch(err => {});
        chrome.storage.local.get('linkYoutubePlay', function (result) {
            if (result.linkYoutubePlay == true) {
                chrome.contextMenus.create({
                    title: chrome.i18n.getMessage('linkOpen'),
                    id: 'linkYoutubePlay',
                    contexts: ['link', 'selection', 'editable'],
                    targetUrlPatterns: ['*://*.youtube.com/watch*', '*://*.youtube.com/playlist*', '*://*.youtube.com/embed*', '*://*.youtu.be/*']
                });
            }
        });
    } else if (request.anyLinkAdd == true) {
        chrome.contextMenus.remove('anyLinkAdd').catch(err => {});
        chrome.contextMenus.remove('linkYoutubeAdd').catch(err => {});
        chrome.contextMenus.create({
            title: chrome.i18n.getMessage('linkAdd'),
            id: 'anyLinkAdd',
            contexts: ['link', 'selection', 'editable', 'video']
        });
    } else if (request.anyLinkAdd == false) {
        chrome.contextMenus.remove('anyLinkAdd').catch(err => {});
        chrome.contextMenus.remove('linkYoutubeAdd').catch(err => {});
        chrome.storage.local.get('linkYoutubeAdd', function (result) {
            if (result.linkYoutubeAdd == true) {
                chrome.contextMenus.create({
                    title: chrome.i18n.getMessage('linkAdd'),
                    id: 'linkYoutubeAdd',
                    contexts: ['link', 'selection', 'editable'],
                    targetUrlPatterns: ['*://*.youtube.com/watch*', '*://*.youtube.com/playlist*', '*://*.youtube.com/embed*', '*://*.youtu.be/*']
                });
            }
        });
    } else if (request.linkYoutubePlay == true) {
        chrome.contextMenus.remove('linkYoutubePlay').catch(err => {});
        chrome.storage.local.get('anyLinkOpen', function (result) {
            if (result.anyLinkOpen == false) {
                chrome.contextMenus.create({
                    title: chrome.i18n.getMessage('linkOpen'),
                    id: 'linkYoutubePlay',
                    contexts: ['link', 'selection', 'editable'],
                    targetUrlPatterns: ['*://*.youtube.com/watch*', '*://*.youtube.com/playlist*', '*://*.youtube.com/embed*', '*://*.youtu.be/*']
                });
            }
        });
    } else if (request.linkYoutubePlay == false) {
        chrome.contextMenus.remove('linkYoutubePlay').catch(err => {});
    } else if (request.linkYoutubeAdd == true) {
        chrome.contextMenus.remove('linkYoutubeAdd').catch(err => {});
        chrome.storage.local.get('anyLinkAdd', function (result) {
            if (result.anyLinkAdd == false) {
                chrome.contextMenus.create({
                    title: chrome.i18n.getMessage('linkAdd'),
                    id: 'linkYoutubeAdd',
                    contexts: ['link', 'selection', 'editable'],
                    targetUrlPatterns: ['*://*.youtube.com/watch*', '*://*.youtube.com/playlist*', '*://*.youtube.com/embed*', '*://*.youtu.be/*']
                });
            }
        });
    } else if (request.linkYoutubeAdd == false) {
        chrome.contextMenus.remove('linkYoutubeAdd').catch(err => {});
    }
}

chrome.runtime.onMessage.addListener(onMessageListener);
chrome.contextMenus.onClicked.addListener(contextMenusListener);
