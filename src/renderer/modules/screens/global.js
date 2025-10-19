export function openSceneScreen(screenName) {
    if (screenName === "titlescreen") {
        require("./titleScreen.js").startTitleScreen()
    }
    if (screenName === "controllerSelect") {
        require("./connectionScreen.js").startControllerSelect()
    }
    if (screenName === "hud") {
        require("./hudScreen.js").initHud()
    }
    if (screenName === "bootscreen") {
        require("./bootscreen.js").startBootscreen()
    }
    if (screenName === "scoreRecap") {
        require("./scoreRecapScreen.js").startScoreRecapScreen()
    }
    /*
    if (screenName === "settings") {
        require("./settingsScreen.js").startSettingsScreen()
    }
    if (screenName === "credits") {
        require("./creditsScreen.js").startCreditsScreen()
    }*/
}