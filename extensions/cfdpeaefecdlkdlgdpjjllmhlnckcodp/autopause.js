var pauseAndPlay = window.localStorage['pauseAndPlay'];
var vpause = window.localStorage['vpause'];
var ytPlayer;
var mainDelay = 250;
//var channelDelay = 400;
var devMode = false;

document.addEventListener('SetPauseAndPlay', function (e) {
	if (devMode) console.log('PPYoutube SetPauseAndPlay;')
	SetPauseAndPlay();
});

function SetPause() {
	if (ytPlayer.getPlayerState() == 1) {
		if (devMode) console.log('PPYoutube ytPlayer.pauseVideo();')
		ytPlayer.pauseVideo();
		return;
	}
	else setTimeout(function() { SetPause(); }, mainDelay);
}
function SetPauseAndPlay() {
	if (ytPlayer.getPlayerState() == 1 && pauseAndPlay == "true")
   	ytPlayer.pauseVideo();
}
/*function SetPauseOnChannel() {
	if (typeof ytPlayer.getPlayerState != 'undefined' && ytPlayer.getPlayerState() != -1 && ytPlayer.getPlayerState() != 5 && ytPlayer.getPlayerState() != 3) {
		SetPause();
		return;
	}
	else setTimeout(function() { SetPauseOnChannel(); }, channelDelay);
}*/
function ChangeYoutubePage(event) {
	if (typeof ytPlayer.getPlayerState == 'undefined' || ytPlayer.getPlayerState() == -1 || ytPlayer.getPlayerState() == 5 || ytPlayer.getPlayerState() == 3) {
  		setTimeout(function() { ChangeYoutubePage(event); }, mainDelay);
		return;
	}
	if (event == -1 && typeof ytPlayer.getPlayerState != 'undefined' && ytPlayer.getPlayerState() >= 0 && ytPlayer.getPlayerState() != 2) {
		SetPause();
		if (window.location.href.match(/#t=/i)) SetPause();
	} else return;
}
ytPlayer = document.getElementById('movie_player');
function shareYouTubePlayerApi(original) {
	return function() {
		//console.log('triedToPayse shareYouTubePlayerApi');
		playerReady();
		if (original) {
			return original.apply(this, arguments);
		}
	};
}
//console.log('triedToPayse injecting ' + window.onYouTubePlayerReady);
window.onYouTubePlayerReady = shareYouTubePlayerApi(window.onYouTubePlayerReady);
if (typeof ytPlayer.getPlayerState != 'undefined') playerReady();
function playerReady() {
	//console.log('triedToPayse s ' + window.localStorage['vpause']);
	if (vpause == "true" && self == top) {
		if (window.location.href.match(/watch/i)) {
			setTimeout(function() { SetPause(); }, 500);
			//if (window.location.href.match(/#t=/i)) setTimeout(function() { SetPause(); }, 250);
		}
		/*if (window.location.href.match(/channel/i) || window.location.href.match(/user/i)) {
			//SetPauseOnChannel();
		}*/
		ytPlayer.addEventListener('onStateChange', ChangeYoutubePage);
	}
}