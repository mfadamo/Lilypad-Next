bkg_audio.play()
setAudiobkgVol(1)

//Keymapping Place
function dance(event){
    if (event.key === 'Enter') {
        setAudiobkgVol(0)
        gfunc.startTransition(true, 'scene/ui/home.html', 'scene/act/home.js', 0)
        gfunc.onkeypressed = null;
        document.removeEventListener('keydown', dance);
    }
}
document.addEventListener('keydown', dance);