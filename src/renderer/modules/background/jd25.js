export class StarfieldBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.gl = canvas.getContext('webgl');
        this.bubbles = [];
        this.init();
    }

    init() {
        const gl = this.gl;

        // Vertex shader
        const vsSource = `
            attribute vec4 aPosition;
            uniform vec2 uResolution;
            uniform vec2 uTranslation;
            uniform float uScale;
            void main() {
                vec2 position = (aPosition.xy + uTranslation) / uResolution * 2.0 - 1.0;
                gl_Position = vec4(position * vec2(1, -1), 0, 1);
                gl_PointSize = uScale;
            }
        `;

        // Fragment shader
        const fsSource = `
            precision mediump float;
            uniform vec4 uColor;
            void main() {
            vec2 coord = gl_PointCoord * 2.0 - 1.0;
                float r = length(coord);
                float alpha = 1.0 - smoothstep(0.0, 1.0, r);
                gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
            }
        `;

        // Create program
        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        this.program = this.createProgram(gl, vertexShader, fragmentShader);

        // Get locations
        this.positionLocation = gl.getAttribLocation(this.program, 'aPosition');
        this.resolutionLocation = gl.getUniformLocation(this.program, 'uResolution');
        this.translationLocation = gl.getUniformLocation(this.program, 'uTranslation');
        this.colorLocation = gl.getUniformLocation(this.program, 'uColor');
        this.scaleLocation = gl.getUniformLocation(this.program, 'uScale');

        // Create bubbles
        for (let i = 0; i < 50; i++) {
            // Create bubble with random color between pink and blue
            const isPink = Math.random() < 0.5;
            const r = isPink ? 1.0 : 0.2;     // Pink has high red, blue has low red
            const g = isPink ? 0.4 : 0.3;     // Both have low green
            const b = isPink ? 0.7 : 1.0;     // Pink has medium blue, blue has high blue

            this.bubbles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                dx: (Math.random() - 0.5) * 2,
                dy: (Math.random() - 0.5) * 2,
                scale: this.canvas.width /4,
                color: Math.random() * 2,
                baseColor: { r, g, b }    // Store the base color
            });
        }

        // Setup buffer
        const positions = new Float32Array([0, 0]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Start animation
        this.animate();
    }

    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        return program;
    }

    isAnimating = true;

    animate() {
        if (this.isAnimating) {
            this.render();
            requestAnimationFrame(() => this.animate());
        }
    }

    pause() {
        this.isAnimating = false;
    }

    continue() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }

    render() {
        const gl = this.gl;

        // Resize canvas to full window
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear canvas
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use program
        gl.useProgram(this.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Set resolution
        gl.uniform2f(this.resolutionLocation, gl.canvas.width, gl.canvas.height);

        // Enable position attribute
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Update and draw bubbles
        this.bubbles.forEach(bubble => {
            // Update position
            bubble.x += bubble.dx;
            bubble.y += bubble.dy;

            // Bounce off walls
            if (bubble.x < 0 || bubble.x > gl.canvas.width) bubble.dx *= -1;
            if (bubble.y < 0 || bubble.y > gl.canvas.height) bubble.dy *= -1;

            // Update color (randomized smooth transition)
            bubble.color += 0.005;
            bubble.color %= Math.PI * 2;

            // Use sine waves with different frequencies for more variety
            const r = 0.6 + Math.sin(bubble.color * 1.1) * 0.4; // Stronger red
            const g = 0.1 + Math.sin(bubble.color * 0.5) * 0.1; // Keep green minimal
            const b = 0.5 + Math.sin(bubble.color) * 0.5;       // Stronger blue

            // Set uniforms
            gl.uniform2f(this.translationLocation, bubble.x, bubble.y);
            gl.uniform4f(this.colorLocation, r, g, b, 0.2);
            gl.uniform1f(this.scaleLocation, bubble.scale);

            // Draw
            gl.drawArrays(gl.POINTS, 0, 1);
        });
    }
}
