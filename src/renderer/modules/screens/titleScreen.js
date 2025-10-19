import { changeSceneHTML } from '../webRenderer.js';
import { TransitionManager } from '../transitions/default.js'
import m_jd2015 from '../../../assets/audio/ui/music_jd2015.ogg';
import './titleComponents/titlescreen.css';

console.log("Loading audio file:", m_jd2015);
const audiomenu = document.querySelector('audio');
audiomenu.src = m_jd2015;
audiomenu.loop = true;

export function startTitleScreen() {
    audiomenu.play();
    console.log("Title screen started");
    changeSceneHTML('titlescreen', {
        tag: "div",
        attrs: { id: "TitleScreen" },
        children: [
            {
                tag: "img",
                attrs: { id: "JDLogo", src: "" }
            },
            {
                tag: "span",
                attrs: { class: "txt-wait" },
                children: ["Please Wait"]
            },
            {
                tag: "div",
                attrs: { class: "test-container" },
                children: [
                    {
                        tag: "input",
                        attrs: { class: "selectmap", oninput: 'window.currentMaps = this.value', uinavable: "" },
                        children: ["Please Wait"]
                    },
                    {
                        tag: "button",
                        attrs: { class: "play-map", uinavable: "" },
                        children: ["Test Map"]
                    }, {
                        tag: "button",
                        attrs: { class: "open-controller", uinavable: "" },
                        children: ["Connect Controller"]
                    }]
            }
        ]
    })
    document.querySelector('.play-map').addEventListener('click', () => {
        require("./hudScreen.js").initHud()
        audiomenu.pause()
    })
    document.querySelector('.open-controller').addEventListener('click', () => {
        TransitionManager.startTransition(1, (e) => {
            require("./connectionScreen.js").startControllerSelect()
        }
        )
    })
}
