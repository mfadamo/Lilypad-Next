import './bootComponents/bootScreen.css';
import { changeSceneHTML } from '../webRenderer.js';
import { TransitionManager } from '../transitions/default.js'

export function startBootscreen() {
  console.log("Bootscreen started, changing soon...");

  changeSceneHTML('bootscreen', {
    tag: "div",
    attrs: { id: "TitleScreen" },
    children: [
      {
        tag: "img",
        attrs: { id: "JDLogo", src: require("../../../assets/texture/ui/JD_Series.webp") }
      },
      {
        tag: "span",
        attrs: { class: "txt-warning" },
        children: [
          "Lilypad is a fan-created modification inspired by the gameplay and style of Just Dance. ",
          "This project is independent and not affiliated with Ubisoft.\n\n"
        ]
      },
      {
        tag: "span",
        attrs: { class: "txt-wait" },
        children: ["Loading resources..."]
      },
      {
        tag: "div",
        attrs: { class: "ui-loading fast" },
        children: []
      }
    ]
  });

  // make everything faster
  setTimeout(() => {
    const { startTitleScreen } = require('./titleScreen.js');
    TransitionManager.startTransition(0.5, (e) => {
      changeSceneHTML('bootscreen', {
        tag: "div",
        attrs: { id: "TitleScreen" },
        children: [
          {
            tag: "img",
            attrs: { id: "JDLogo", src: require("../../../assets/texture/ui/JD_Series.webp") }
          },
          {
            tag: "span",
            attrs: { class: "txt-warning" },
            children: [
              "⚠️ Epilepsy Warning:\n",
              "This game contains flashing lights and rapidly changing visuals that may trigger seizures in individuals with photosensitive epilepsy.\n\n",
              "Player discretion is advised."
            ]
          },
          {
            tag: "div",
            attrs: { class: "ui-loading fast" },
            children: []
          }
        ]
      });
      console.log("Bootscreen finished, starting title screen soon...");
      setTimeout(() => {
        TransitionManager.startTransition(0.5, (e) => {
          startTitleScreen();
        });
      }, 2000);
    });
  }, 1000);
}
