// ES6 import
import './styles.css';

//audioHandler
import { SFXManager } from './modules/audio/sfx';

//background
import { StarfieldBackground } from './modules/background/jd25'

//resizer
import { Resizer } from './modules/canvasHandler/resizer'

//screen
import { startBootscreen } from './modules/screens/bootscreen';

// Controls
import { SpatialNavigation } from './modules/controls/spatial';


document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('plasmaCanvas');
    window.starfield = new StarfieldBackground(canvas);

    const resizer = new Resizer();

    resizer.adjustGameDimensions();

    SFXManager.play('click');

    window.addEventListener('resize', () => {
        resizer.adjustGameDimensions();
    });

    startBootscreen();

    window.navigation = new SpatialNavigation({
        selector: '[data-navable], .navable, [uinavable]',
        
        onFocusChanged: (newElement, prevElement) => {
        },
        
        gamepadSupport: true
    });


    // Initialize Player Objects
    // This function creates a default player object with the given ID
    function createDefaultPlayer(id) {
        return {
            id: id,
            name: `Player ${id}`,
            avatar: "default",
            isActive: false,
            isBot: false,
            isMainController: false,
            isController: false,
            isSendingMotion: false,
            currentSelectedCoach: 0,
            controllerType: null, // "kinect" | "webcam" | "phone" | etc.
            motionBuffer: [],
            score: 0,
        };
    }
    
    window.players = {};
    const numberOfPlayers = 6;
    
    for (let i = 1; i <= numberOfPlayers; i++) {
        window.players[`player${i}`] = createDefaultPlayer(i);
    }
    
    

});