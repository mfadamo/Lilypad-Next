export class Resizer {
    constructor() {
        this.initialWidth = 690;
        this.initialHeight = 690;
        this.aspectRatio = 16 / 9;
        this.baseFontSize = 120; // Base font size in pixels
    }

    adjustGameDimensions() {
        const gameElement = document.getElementById("Game");
        const { clientWidth, clientHeight } = document.documentElement;

        if (clientWidth / clientHeight > this.aspectRatio) {
            const newHeight = clientHeight;
            const newWidth = newHeight * this.aspectRatio;
            this.adjustElementSize(newWidth, newHeight, gameElement);
        } else {
            const newWidth = clientWidth;
            const newHeight = newWidth / this.aspectRatio;
            this.adjustElementSize(newWidth, newHeight, gameElement);
        }
    }

    adjustElementSize(newWidth, newHeight, element) {
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;

        const scaleFactor = Math.min(
            newWidth / this.initialWidth,
            newHeight / this.initialHeight
        );
        const fontSizeInPixels = this.baseFontSize * scaleFactor;
        element.style.fontSize = `${fontSizeInPixels}px`;
    }
}