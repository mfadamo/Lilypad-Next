/**
 * A high-performance WebGL2 particle system using texture-based particles
 * and configurable explosion patterns.
 *
 * @class WebGLFeedBackParticleSystem
 */
export default class WebGLFeedBackParticleSystem {
    /**
     * @param {HTMLCanvasElement} canvas The canvas element to render on.
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');

        if (!this.gl) {
            console.error('WebGL 2 not supported, falling back to WebGL 1 is not implemented.');
            return;
        }

        // --- Properties ---
        this.program = null;
        this.vao = null;
        this.buffer = null;

        /** @type {Object.<string, WebGLTexture>} */
        this.textures = {};
        this.textureURLs = {
            star: require('../../../../../assets/texture/ui/star_glow.webp'),
            circle: require('../../../../../assets/texture/ui/circle_particle.png'),
            ring: require('../../../../../assets/texture/ui/ring_particle.png'),
        };

        /** @type {Array<Object>} */
        this.animations = [];
        this.isRunning = false;

        this.maxCount = 500; // Increased particle capacity
        this.particleBufferOffset = 0;
        this.FLOATS_PER_PARTICLE = 8; // vec2 pos, vec2 vel, float startTime, float size, float pattern, float dirX

        this.loadParticleTextures().then(() => {
            this.initGL();
        }).catch(err => {
            console.error("Failed to initialize particle system:", err);
        });
    }

    /**
     * Cleans up all WebGL resources to prevent memory leaks.
     */
    destroy() {
        if (!this.gl) return;
        this.isRunning = false;

        const gl = this.gl;

        Object.values(this.textures).forEach(texture => gl.deleteTexture(texture));
        if (this.buffer) gl.deleteBuffer(this.buffer);
        if (this.vao) gl.deleteVertexArray(this.vao);

        if (this.program) {
            const shaders = gl.getAttachedShaders(this.program);
            shaders.forEach(shader => gl.deleteShader(shader));
            gl.deleteProgram(this.program);
        }

        this.textures = {};
        this.buffer = null;
        this.program = null;
        this.vao = null;

        const loseCtx = this.gl.getExtension('WEBGL_lose_context');
        if (loseCtx) {
            loseCtx.loseContext();
        }
        this.gl = null;
    }

    /**
     * Asynchronously loads all required particle textures.
     * @returns {Promise<void>} A promise that resolves when all textures are loaded or have failed.
     */
    loadParticleTextures() {
        const gl = this.gl;
        const textureNames = Object.keys(this.textureURLs);

        const promises = textureNames.map(name => new Promise((resolve) => {
            const path = this.textureURLs[name];
            const texture = gl.createTexture();
            this.textures[name] = texture;

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

            const image = new Image();
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                resolve();
            };
            image.onerror = () => {
                console.warn(`Failed to load texture: ${path}. Creating fallback.`);
                this.createFallbackTexture(name);
                resolve();
            };
            image.src = path;
        }));

        return Promise.all(promises);
    }

    /**
     * Creates a procedurally generated fallback texture if image loading fails.
     * @param {string} type The type of texture to create ('star', 'circle', 'ring').
     */
    createFallbackTexture(type) {
        const gl = this.gl;
        const texture = this.textures[type];
        gl.bindTexture(gl.TEXTURE_2D, texture);

        const texCanvas = document.createElement('canvas');
        texCanvas.width = texCanvas.height = 64;
        const ctx = texCanvas.getContext('2d');

        const cx = 32, cy = 32;

        switch (type) {
            case 'star': {
                const outerRadius = 28, innerRadius = 12, points = 5;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius);
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                for (let i = 0; i < points * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (i * Math.PI) / points - Math.PI / 2;
                    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'circle': {
                const radius = 30;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.7, 'rgba(255,255,255,0.8)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'ring': {
                const radius = 30, thickness = 6;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.arc(cx, cy, radius - thickness, 0, Math.PI * 2, true);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fill();
                break;
            }
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    /**
     * Initializes WebGL program, shaders, buffers, and attributes.
     */
    initGL() {
        const gl = this.gl;

        const vsSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_velocity;
            in float a_startTime;
            in float a_size;
            in float a_pattern;
            in float a_dirX;

            uniform float u_time;
            uniform float u_duration;
            uniform vec2 u_resolution;
            uniform float u_scale;
            
            out float v_alpha;
            
            void main() {
              float t = (u_time - a_startTime) / u_duration;
              if (t < 0.0 || t > 1.0) {
                gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
                gl_PointSize = 0.0;
                v_alpha = 0.0;
                return;
              }
              
              v_alpha = t > 0.67 ? 1.0 - ((t - 0.67) / 0.33) : 1.0;
              
              vec2 pos = a_position;
              float sizeScale = 1.0;
              
              if (a_pattern < 0.5) { // Explosion
                pos += a_velocity * t;
                sizeScale = mix(0.5, 1.0, 1.0 - t * 0.5);
              } else if (a_pattern < 1.5) { // Expanding ring
                sizeScale = mix(0.1, 1.5, t);
              } else if (a_pattern < 2.5) { // Horizontal ripple
                float direction = a_dirX > 0.5 ? 1.0 : -1.0;
                pos.x += direction * (t * u_resolution.x * 0.3);
                pos.y += sin(t * 6.0) * 15.0;
                sizeScale = mix(0.8, 1.2, (sin(t * 8.0) + 1.0) * 0.5);
              }
              
              vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
              gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
              gl_PointSize = u_scale * a_size * sizeScale;
            }
        `;

        const fsSource = `#version 300 es
            precision mediump float;
            
            uniform vec3 u_color;
            uniform sampler2D u_texture;
            
            in float v_alpha;
            out vec4 outColor;
            
            void main() {
              vec4 texColor = texture(u_texture, gl_PointCoord);
              outColor = vec4(u_color, texColor.a * v_alpha);
            }
        `;

        const createShader = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertShader = createShader(gl.VERTEX_SHADER, vsSource);
        const fragShader = createShader(gl.FRAGMENT_SHADER, fsSource);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertShader);
        gl.attachShader(this.program, fragShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(this.program));
            return;
        }
        
        gl.detachShader(this.program, vertShader);
        gl.detachShader(this.program, fragShader);
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);

        this.uniforms = {
            u_time: gl.getUniformLocation(this.program, 'u_time'),
            u_duration: gl.getUniformLocation(this.program, 'u_duration'),
            u_resolution: gl.getUniformLocation(this.program, 'u_resolution'),
            u_color: gl.getUniformLocation(this.program, 'u_color'),
            u_scale: gl.getUniformLocation(this.program, 'u_scale'),
            u_texture: gl.getUniformLocation(this.program, 'u_texture'),
        };

        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.maxCount * this.FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        const stride = this.FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT;
        const attributeSetup = [
            { name: 'a_position',  size: 2, offset: 0 },
            { name: 'a_velocity',  size: 2, offset: 2 },
            { name: 'a_startTime', size: 1, offset: 4 },
            { name: 'a_size',      size: 1, offset: 5 },
            { name: 'a_pattern',   size: 1, offset: 6 },
            { name: 'a_dirX',      size: 1, offset: 7 },
        ];

        attributeSetup.forEach(attr => {
            const loc = gl.getAttribLocation(this.program, attr.name);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, attr.size, gl.FLOAT, false, stride, attr.offset * Float32Array.BYTES_PER_ELEMENT);
        });

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    startRenderLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        requestAnimationFrame(this.renderLoop.bind(this));
    }

    renderLoop(now) {
        if (!this.gl || !this.isRunning) return;

        this.animations = this.animations.filter(anim => now - anim.start < anim.duration);

        if (this.animations.length > 0) {
            this.renderParticles(now);
            requestAnimationFrame(this.renderLoop.bind(this));
        } else {
            this.isRunning = false;
            this.particleBufferOffset = 0;
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
    }

    renderParticles(now) {
        const gl = this.gl;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.uniform2f(this.uniforms.u_resolution, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(this.uniforms.u_time, now);
        gl.uniform1i(this.uniforms.u_texture, 0);
        gl.activeTexture(gl.TEXTURE0);

        const animationsByTexture = this.animations.reduce((acc, anim) => {
            (acc[anim.textureName] = acc[anim.textureName] || []).push(anim);
            return acc;
        }, {});

        for (const textureName in animationsByTexture) {
            gl.bindTexture(gl.TEXTURE_2D, this.textures[textureName]);
            for (const anim of animationsByTexture[textureName]) {
                gl.uniform1f(this.uniforms.u_duration, anim.duration);
                gl.uniform3fv(this.uniforms.u_color, anim.color);
                gl.uniform1f(this.uniforms.u_scale, anim.scale);
                gl.drawArrays(gl.POINTS, anim.startIndex, anim.count);
            }
        }

        gl.bindVertexArray(null);
    }

    explode({ type, duration = 1500, scale = 1, count, shape = 'circle', distancePercent = 50, pattern = 0, direction = 'both' }) {
        if (!this.gl || !this.program) return;

        const colorMap = {
            yeah: [1.0, 0.9, 0.0],
            perfect: [0.3, 1.0, 0.2],
            super: [0.0, 1.0, 0.93],
            good: [0.1, 0.6, 1.0],
        };

        const cnt = count || (shape === 'star' ? 25 : (pattern === 2 ? 35 : 30));
        const textureName = shape === 'star' ? 'star' : shape === 'ring' ? 'ring' : 'circle';
        const startIndex = this.getParticleBufferOffset(cnt);

        if (startIndex < 0) {
            console.warn('Particle buffer is full. Skipping new explosion.');
            return;
        }

        const animation = {
            start: performance.now(),
            duration,
            count: cnt,
            color: colorMap[type] || [1, 1, 1],
            scale,
            textureName,
            startIndex,
        };
        this.animations.push(animation);

        const particleData = new Float32Array(cnt * this.FLOATS_PER_PARTICLE);
        const centerX = this.gl.canvas.width / 2;
        const centerY = this.gl.canvas.height / 2;
        const minCanvasDim = Math.min(this.gl.canvas.width, this.gl.canvas.height);
        const maxDistance = (minCanvasDim / 2) * (distancePercent / 100);

        for (let i = 0; i < cnt; i++) {
            const b = i * this.FLOATS_PER_PARTICLE;
            particleData[b] = centerX;
            particleData[b + 1] = centerY;
            particleData[b + 4] = animation.start;
            particleData[b + 6] = pattern;

            if (pattern === 0) { // Explosion
                const angle = Math.random() * Math.PI * 2;
                // ADJUSTED: Re-introduce distanceFactor to scale size
                const distanceFactor = Math.sqrt(Math.random());
                const speed = (maxDistance * distanceFactor) / (duration / 1000);
                particleData[b + 2] = Math.cos(angle) * speed;
                particleData[b + 3] = Math.sin(angle) * speed;
                particleData[b + 5] = shape === 'star'
                    ? (8 + Math.random() * 6) * (1 - distanceFactor * 0.3)
                    : (5 + Math.random() * 4) * (1 - distanceFactor * 0.3);
            } else if (pattern === 1) { // Expanding ring
                particleData[b + 2] = 0;
                particleData[b + 3] = 0;
                particleData[b + 5] = (shape === 'ring' ? 15 : 8) + Math.random() * 10;
            } else if (pattern === 2) { // Horizontal ripple
                particleData[b] += (Math.random() - 0.5) * 20;
                particleData[b + 1] += (Math.random() - 0.5) * 20;
                particleData[b + 2] = 0;
                particleData[b + 3] = 0;
                particleData[b + 5] = 6 + Math.random() * 5;
                if (direction === 'left') particleData[b + 7] = 0;
                else if (direction === 'right') particleData[b + 7] = 1;
                else particleData[b + 7] = Math.random() > 0.5 ? 1 : 0;
            }
        }

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, startIndex * this.FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT, particleData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.startRenderLoop();
    }

    getParticleBufferOffset(count) {
        if (this.particleBufferOffset + count > this.maxCount) {
            return -1;
        }
        const offset = this.particleBufferOffset;
        this.particleBufferOffset += count;
        return offset;
    }

    resizeCanvas() {
        this.canvas.width = 459;
        this.canvas.height = 449;
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}