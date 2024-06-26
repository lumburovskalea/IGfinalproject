// Define global variables for WebGL context and shader programs
let gl;
let shaderProgram;

let backgroundTexture;

// Define variables for pendulum simulation parameters
let length = 5.0;
let gravity = 9.8;
let damping = 0.99;
let pendulumColor = [1.0, 0.0, 0.0]; // Default color: red
let shininess = 32.0; // Initial shininess

// Variables for light intensity
let lightIntensity = 0.8;

// Define variables for pendulum simulation
let angle = Math.PI / 3;  // Initial angle (60 degrees)
let angularVelocity = 0.0;

// Vertex and index buffers
let sphereVertexPositionBuffer;
let sphereVertexNormalBuffer;
let sphereVertexIndexBuffer;

let lineVertexPositionBuffer;

let secondSphereVertexPositionBuffer;
let secondSphereVertexNormalBuffer;
let secondSphereVertexIndexBuffer;

// Initialize WebGL
function initWebGL(canvas) {
    gl = canvas.getContext("webgl");
    if (!gl) {
        console.error("WebGL not supported, falling back on experimental-webgl");
        gl = canvas.getContext("experimental-webgl");
    }
    if (!gl) {
        alert("Your browser does not support WebGL");
    }
}

// Compile shaders and link program
function initShaders() {
    // Vertex shader source code
    const vsSource = `
    attribute vec3 aVertexPosition;
    attribute vec3 aVertexNormal;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;
    
    void main(void) {
        vNormal = aVertexNormal;
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
    }
    `;
    // Fragment shader source code
    const fsSource = `
    precision mediump float;
    uniform float uLightIntensity;
    uniform vec3 uPendulumColor;
    uniform float uShininess; // New uniform for shininess
    varying vec3 vNormal;
    uniform sampler2D uBackgroundTexture;

    void main(void) {
        vec3 lightColor = vec3(1.0, 1.0, 1.0);
        vec3 ambientColor = vec3(0.3, 0.3, 0.3);
        vec3 lightDir = normalize(vec3(0.0, 0.0, 1.0));
        float lambertian = max(dot(vNormal, lightDir), 0.0);

        // Specular reflection calculation
        vec3 viewDir = normalize(-vec3(gl_FragCoord));
        vec3 reflectDir = reflect(-lightDir, vNormal);
        float specular = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);

        vec3 color = ambientColor + lightColor * uLightIntensity * lambertian;
        color += lightColor * specular * uShininess; // Add specular reflection contribution
        
        vec3 reflectedDir = reflect(viewDir, vNormal);
        vec2 uv = 0.5 + 0.5 * vec2(reflectedDir.x, reflectedDir.y);
        vec3 backgroundColor = texture2D(uBackgroundTexture, uv).rgb;

         vec3 finalColor = mix(color * uPendulumColor, backgroundColor, 0.5);

        gl_FragColor = vec4(finalColor, 1.0);;
    }
    `;

    // Create vertex shader
    const vertexShader = createShader(gl.VERTEX_SHADER, vsSource);
    // Create fragment shader
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fsSource);

    // Create shader program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Error linking shader program:", gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    // Use the shader program
    gl.useProgram(shaderProgram);

    // Get attribute and uniform locations
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.uBackgroundTexture = gl.getUniformLocation(shaderProgram, "uBackgroundTexture");
    console.log("Uniform location for background texture:", shaderProgram.uBackgroundTexture);
    shaderProgram.uModelViewMatrix = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");
    shaderProgram.uProjectionMatrix = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
    shaderProgram.uLightIntensity = gl.getUniformLocation(shaderProgram, "uLightIntensity");
    shaderProgram.uPendulumColor = gl.getUniformLocation(shaderProgram, "uPendulumColor");
    shaderProgram.uShininess = gl.getUniformLocation(shaderProgram, "uShininess");
}

function setPendulumColor(color) {
    // Convert hex color to RGB
    const r = parseInt(color.slice(1, 3), 16) / 255.0;
    const g = parseInt(color.slice(3, 5), 16) / 255.0;
    const b = parseInt(color.slice(5, 7), 16) / 255.0;
    pendulumColor = [r, g, b];
}

// Function to create a shader
function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Function to initialize the line buffer
function initLineBuffer() {
    // Line vertices (simply two points)
    const lineVertices = [
        0.0, 0.0, 0.0,
        0.0, -length, 0.0
    ];

    // Create or update line vertex buffer
    if (!lineVertexPositionBuffer) {
        lineVertexPositionBuffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineVertices), gl.STATIC_DRAW);
    lineVertexPositionBuffer.itemSize = 3;
    lineVertexPositionBuffer.numItems = lineVertices.length / 3;
}

function initSecondSphereBuffer() {
    const sphereRadius = 0.8; 
    const sphereLatitudeBands = 30;
    const sphereLongitudeBands = 30;
    const sphereVertices = [];
    const sphereNormals = [];
    for (let latNumber = 0; latNumber <= sphereLatitudeBands; latNumber++) {
        const theta = latNumber * Math.PI / sphereLatitudeBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        for (let longNumber = 0; longNumber <= sphereLongitudeBands; longNumber++) {
            const phi = longNumber * 2 * Math.PI / sphereLongitudeBands;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;
            const u = 1 - (longNumber / sphereLongitudeBands);
            const v = 1 - (latNumber / sphereLatitudeBands);
            sphereNormals.push(x);
            sphereNormals.push(y);
            sphereNormals.push(z);
            sphereVertices.push(sphereRadius * x);
            sphereVertices.push(sphereRadius * y);
            sphereVertices.push(sphereRadius * z);
        }
    }
    const sphereIndices = [];
    for (let latNumber = 0; latNumber < sphereLatitudeBands; latNumber++) {
        for (let longNumber = 0; longNumber < sphereLongitudeBands; longNumber++) {
            const first = (latNumber * (sphereLongitudeBands + 1)) + longNumber;
            const second = first + sphereLongitudeBands + 1;
            sphereIndices.push(first);
            sphereIndices.push(second);
            sphereIndices.push(first + 1);
            sphereIndices.push(second);
            sphereIndices.push(second + 1);
            sphereIndices.push(first + 1);
        }
    }

    secondSphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, secondSphereVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.STATIC_DRAW);
    secondSphereVertexPositionBuffer.itemSize = 3;
    secondSphereVertexPositionBuffer.numItems = sphereVertices.length / 3;

    secondSphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, secondSphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals), gl.STATIC_DRAW);
    secondSphereVertexNormalBuffer.itemSize = 3;
    secondSphereVertexNormalBuffer.numItems = sphereNormals.length / 3;

    secondSphereVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, secondSphereVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereIndices), gl.STATIC_DRAW);
    secondSphereVertexIndexBuffer.itemSize = 1;
    secondSphereVertexIndexBuffer.numItems = sphereIndices.length;
}

// Function to set up buffers for the pendulum
function initBuffers() {
    // Sphere vertices and normals
    const sphereRadius = 0.3;
    const sphereLatitudeBands = 30;
    const sphereLongitudeBands = 30;
    const sphereVertices = [];
    const sphereNormals = [];
    for (let latNumber = 0; latNumber <= sphereLatitudeBands; latNumber++) {
        const theta = latNumber * Math.PI / sphereLatitudeBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        for (let longNumber = 0; longNumber <= sphereLongitudeBands; longNumber++) {
            const phi = longNumber * 2 * Math.PI / sphereLongitudeBands;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;
            const u = 1 - (longNumber / sphereLongitudeBands);
            const v = 1 - (latNumber / sphereLatitudeBands);
            sphereNormals.push(x);
            sphereNormals.push(y);
            sphereNormals.push(z);
            sphereVertices.push(sphereRadius * x);
            sphereVertices.push(sphereRadius * y);
            sphereVertices.push(sphereRadius * z);
        }
    }
    const sphereIndices = [];
    for (let latNumber = 0; latNumber < sphereLatitudeBands; latNumber++) {
        for (let longNumber = 0; longNumber < sphereLongitudeBands; longNumber++) {
            const first = (latNumber * (sphereLongitudeBands + 1)) + longNumber;
            const second = first + sphereLongitudeBands + 1;
            sphereIndices.push(first);
            sphereIndices.push(second);
            sphereIndices.push(first + 1);
            sphereIndices.push(second);
            sphereIndices.push(second + 1);
            sphereIndices.push(first + 1);
        }
    }

    // Create sphere vertex buffer
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = sphereVertices.length / 3;

    // Create sphere normal buffer
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals), gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = sphereNormals.length / 3;

    // Create sphere index buffer
    sphereVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereIndices), gl.STATIC_DRAW);
    sphereVertexIndexBuffer.itemSize = 1;
    sphereVertexIndexBuffer.numItems = sphereIndices.length;

    // Initialize line buffer
    initLineBuffer();
    initSecondSphereBuffer();
}

// Update pendulum simulation based on parameters and time
function updatePendulum(dt) {
    let angularAcceleration = (-gravity / length) * Math.sin(angle);
    angularVelocity += angularAcceleration * dt;
    angularVelocity *= damping;
    angle += angularVelocity * dt;
}

// Function to draw the scene
function drawScene() {
    // Update the simulation
    updatePendulum(0.016); // Assuming 60 FPS for simplicity

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shaderProgram);

    // Set up perspective projection matrix
    const fieldOfView = 45 * Math.PI / 180; // 45 degree field of view in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // Set up model-view matrix
    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -20]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, angle, [0, 0, 1]);

    const secondSphereModelViewMatrix = mat4.create();
    mat4.translate(secondSphereModelViewMatrix, modelViewMatrix, [0, -length, 0]);

    const lineStartPosition = vec3.create();
    const lineEndPosition = vec3.create();
    vec3.set(lineStartPosition, 0, length, 0); // Start of line at pendulum sphere (origin)
    vec3.set(lineEndPosition, 0, 0, 0); // End of line at second sphere

    // Pass matrix data to shaders for the pendulum sphere
    gl.uniformMatrix4fv(shaderProgram.uModelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix4fv(shaderProgram.uProjectionMatrix, false, projectionMatrix);
    gl.uniform1f(shaderProgram.uLightIntensity, lightIntensity);
    gl.uniform3fv(shaderProgram.uPendulumColor, pendulumColor);
    gl.uniform1f(shaderProgram.uShininess, shininess);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.uniform1i(shaderProgram.uBackgroundTexture, 0);

    // Bind and draw the sphere for the pendulum
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, sphereVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer);
    gl.drawElements(gl.TRIANGLES, sphereVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    // Bind and draw the second sphere
    gl.uniformMatrix4fv(shaderProgram.uModelViewMatrix, false, secondSphereModelViewMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, secondSphereVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, secondSphereVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, secondSphereVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, secondSphereVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, secondSphereVertexIndexBuffer);
    gl.drawElements(gl.TRIANGLES, secondSphereVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    // Bind and draw the line
    gl.lineWidth(10.0);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexPositionBuffer);

    // Update line vertex data
    const lineVertices = new Float32Array([
        lineStartPosition[0], lineStartPosition[1], lineStartPosition[2],
        lineEndPosition[0], lineEndPosition[1], lineEndPosition[2]
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, lineVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, 2); 

 
}

function initBackgroundTexture() {
    const image = new Image();
    image.crossOrigin = "anonymous"; 
    image.onload = function() {
        backgroundTexture = loadTexture(image);
    };
    image.src = 'texture.jpg'; // Path to your texture image
}

// Function to load a texture from an image
function loadTexture(image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Flip the image's Y axis to match the WebGL texture coordinate system
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Set the parameters so we can render any size image
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Upload the image into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    console.log("texture binded In loadTexture");
    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

// Function to handle WebGL context lost
function handleContextLost(event) {
    event.preventDefault();
    cancelAnimationFrame(animationFrame);
}

// Function to handle WebGL context restored
function handleContextRestored() {
    initShaders();
    initBuffers();
    initBackgroundTexture();
    drawScene();
}

// Function to start the animation
function startAnimation() {
    function animate() {
        drawScene();
        animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);
}

// Function to initialize everything
function initialize() {
    const canvas = document.getElementById("glCanvas");
    initWebGL(canvas);
    if (gl) {
        initShaders();
        initBuffers();
        initBackgroundTexture();
        gl.enable(gl.DEPTH_TEST);
        startAnimation();
    }
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

    // Get sliders from HTML
    const lengthSlider = document.getElementById("length");
    const gravitySlider = document.getElementById("gravity");
    const dampingSlider = document.getElementById("damping");
    const lightIntensitySlider = document.getElementById("lightIntensity");
    const pendulumColorPicker = document.getElementById("pendulumColor");
    let shininessSlider = document.getElementById("shininessSlider");

    // Add event listeners to update global variables
    lengthSlider.addEventListener("input", function() {
        length = parseFloat(this.value);
        initLineBuffer();
    });

    gravitySlider.addEventListener("input", function() {
        gravity = parseFloat(this.value);
    });

    dampingSlider.addEventListener("input", function() {
        damping = parseFloat(this.value);
    });

    lightIntensitySlider.addEventListener("input", function() {
        lightIntensity = parseFloat(this.value);
    });

    pendulumColorPicker.addEventListener("input", function() {
        setPendulumColor(this.value);
    });

    shininessSlider.addEventListener("input", function() {
        shininess = parseFloat(this.value);

    });
}

window.onload = initialize;
