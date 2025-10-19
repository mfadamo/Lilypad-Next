import { SFXManager } from "../audio/sfx";

export class TransitionManager {
    static show(scrollTime = 0) {
        const transitionScene = document.querySelector('.sceneTransition');
        transitionScene.classList.add('fadeIn');
        transitionScene.style.visibility = "visible";
        if (scrollTime === 0) SFXManager.play('transitionIn');
        return new Promise(resolve => setTimeout(resolve, 2000));
    }

    static hide(scrollTime = 1) {
        const transitionScene = document.querySelector('.sceneTransition');
        transitionScene.classList.remove('fadeIn');
        transitionScene.classList.add('fadeOut');
        if (scrollTime === 1) SFXManager.play('transitionIn');
        
        return new Promise(resolve => {
            setTimeout(() => {
                transitionScene.classList.remove('fadeOut');
                transitionScene.style.visibility = "hidden";
                if (scrollTime === 3) SFXManager.play('transitionIn');
                resolve();
            }, 1000);
        });
    }

    static async startTransition(scrollTime = 1, callback) {
        await this.show(scrollTime);
        if (callback) {
            await callback();
        }
        await this.hide(scrollTime);
    }
}