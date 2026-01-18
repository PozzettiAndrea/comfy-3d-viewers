/**
 * SMPL 3D Viewer - Canvas 2D Implementation
 * Renders SMPL mesh with simple 3D projection (no external dependencies)
 */

import { app } from "../../../../scripts/app.js";

console.log("[SMPL] Loading SMPL Viewer extension");

// Node types that use this viewer
const SMPL_VIEWER_NODES = [
    {
        nodeName: "SMPLViewer",
        extensionName: "comfy3d.smplviewer",
        logPrefix: "[SMPLViewer]"
    }
];

// Orbital camera 3D to 2D projection
function project3D(point, camera) {
    // Compute camera position from spherical coordinates
    const camX = camera.target.x + camera.distance * Math.cos(camera.elevation) * Math.sin(camera.azimuth);
    const camY = camera.target.y + camera.distance * Math.sin(camera.elevation);
    const camZ = camera.target.z + camera.distance * Math.cos(camera.elevation) * Math.cos(camera.azimuth);

    // Forward vector (camera to target, normalized)
    const fwdX = camera.target.x - camX;
    const fwdY = camera.target.y - camY;
    const fwdZ = camera.target.z - camZ;
    const fwdLen = Math.sqrt(fwdX*fwdX + fwdY*fwdY + fwdZ*fwdZ);
    const fx = fwdX/fwdLen, fy = fwdY/fwdLen, fz = fwdZ/fwdLen;

    // Right vector = up(0,1,0) × forward = (fz, 0, -fx)
    const rxRaw = fz, rzRaw = -fx;
    const rLen = Math.sqrt(rxRaw*rxRaw + rzRaw*rzRaw) || 1;
    const rx = rxRaw/rLen, rz = rzRaw/rLen;

    // Up vector = right × forward = (-rz*fy, rz*fx - rx*fz, rx*fy)
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;

    // Transform point to camera space
    const dx = point[0] - camX;
    const dy = point[1] - camY;
    const dz = point[2] - camZ;

    const projX = dx * rx + dz * rz;
    const projY = dx * ux + dy * uy + dz * uz;
    const projZ = dx * fx + dy * fy + dz * fz;

    // Perspective
    const scale = 300 / Math.max(0.1, projZ);
    return {
        x: projX * scale + camera.centerX,
        y: projY * scale + camera.centerY,
        z: projZ
    };
}

// Compute bounding box center of mesh vertices
function computeMeshCenter(vertices) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const v of vertices) {
        minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
        minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
    }

    return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
    };
}

function createSMPLViewerExtension(config) {
    const { extensionName, nodeName, logPrefix } = config;

    app.registerExtension({
        name: extensionName,

        async beforeRegisterNodeDef(nodeType, nodeData, app) {
            if (nodeData.name !== nodeName) return;

            console.log(`${logPrefix} Registering ${nodeName} node`);

            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);

                // Create container
                const container = document.createElement("div");
                container.style.cssText = "position: relative; width: 100%; background: #222; overflow: hidden;";

                // Info bar
                const infoBar = document.createElement("div");
                infoBar.style.cssText = "position: absolute; top: 5px; left: 5px; right: 5px; z-index: 10; display: flex; justify-content: space-between; align-items: center;";
                container.appendChild(infoBar);

                // Frame counter
                const frameCounter = document.createElement("div");
                frameCounter.style.cssText = "padding: 5px 10px; background: rgba(0,0,0,0.7); color: #fff; border-radius: 3px; font-size: 12px; font-family: monospace;";
                frameCounter.textContent = "No data loaded";
                infoBar.appendChild(frameCounter);

                // Canvas
                const canvas = document.createElement("canvas");
                canvas.width = 512;
                canvas.height = 512;
                canvas.style.cssText = "display: block; max-width: 100%; max-height: 100%; object-fit: contain; cursor: grab; margin: 0 auto;";
                container.appendChild(canvas);

                const ctx = canvas.getContext("2d");

                // Controls bar
                const controlsBar = document.createElement("div");
                controlsBar.style.cssText = "display: flex; gap: 10px; padding: 10px; background: #252525; align-items: center;";

                // Play button
                const playButton = document.createElement("button");
                playButton.textContent = "\u25B6";
                playButton.style.cssText = "width: 40px; height: 40px; border: none; border-radius: 6px; background: #4a9eff; color: white; font-size: 16px; cursor: pointer;";
                playButton.disabled = true;
                controlsBar.appendChild(playButton);

                // Frame slider
                const frameSlider = document.createElement("input");
                frameSlider.type = "range";
                frameSlider.min = 0;
                frameSlider.max = 0;
                frameSlider.value = 0;
                frameSlider.disabled = true;
                frameSlider.style.cssText = "flex-grow: 1; height: 6px;";
                controlsBar.appendChild(frameSlider);

                container.appendChild(controlsBar);

                // State
                this.smplViewerState = {
                    canvas: canvas,
                    ctx: ctx,
                    container: container,
                    frameCounter: frameCounter,
                    playButton: playButton,
                    frameSlider: frameSlider,
                    meshData: null,
                    currentFrame: 0,
                    isPlaying: false,
                    camera: {
                        target: { x: 0, y: 0.9, z: 0 },  // Fixed look-at point (body center)
                        azimuth: 0,      // Horizontal angle (radians)
                        elevation: 0.3,  // Vertical angle (radians), start slightly above
                        distance: 3,
                        centerX: canvas.width / 2,
                        centerY: canvas.height / 2
                    },
                    mouseDown: false,
                    lastMouseX: 0,
                    lastMouseY: 0
                };

                // Add DOM widget
                this.addDOMWidget("smpl_viewer", "customCanvas", container);

                const self = this;

                // Mouse controls
                canvas.addEventListener("mousedown", (e) => {
                    self.smplViewerState.mouseDown = true;
                    self.smplViewerState.lastMouseX = e.clientX;
                    self.smplViewerState.lastMouseY = e.clientY;
                    canvas.style.cursor = "grabbing";
                });

                window.addEventListener("mousemove", (e) => {
                    if (self.smplViewerState.mouseDown) {
                        const dx = e.clientX - self.smplViewerState.lastMouseX;
                        const dy = e.clientY - self.smplViewerState.lastMouseY;
                        self.smplViewerState.camera.azimuth -= dx * 0.01;
                        self.smplViewerState.camera.elevation += dy * 0.01;
                        // Clamp elevation to avoid flipping
                        self.smplViewerState.camera.elevation = Math.max(-Math.PI/2 + 0.1,
                            Math.min(Math.PI/2 - 0.1, self.smplViewerState.camera.elevation));
                        self.smplViewerState.lastMouseX = e.clientX;
                        self.smplViewerState.lastMouseY = e.clientY;
                        self.redrawSMPLCanvas();
                    }
                });

                window.addEventListener("mouseup", () => {
                    self.smplViewerState.mouseDown = false;
                    canvas.style.cursor = "grab";
                });

                canvas.addEventListener("wheel", (e) => {
                    e.preventDefault();
                    self.smplViewerState.camera.distance += e.deltaY * 0.01;
                    self.smplViewerState.camera.distance = Math.max(1, Math.min(10, self.smplViewerState.camera.distance));
                    self.redrawSMPLCanvas();
                });

                // Play button
                playButton.onclick = () => {
                    self.smplViewerState.isPlaying = !self.smplViewerState.isPlaying;
                    playButton.textContent = self.smplViewerState.isPlaying ? "\u23F8" : "\u25B6";
                    if (self.smplViewerState.isPlaying) {
                        self.smplViewerState.lastFrameTime = performance.now();
                        self.animateSMPL();
                    }
                };

                // Frame slider
                frameSlider.oninput = (e) => {
                    self.smplViewerState.currentFrame = parseInt(e.target.value);
                    self.updateSMPLFrame();
                };

                // Handle data from backend
                this.onExecuted = (message) => {
                    if (message?.smpl_mesh) {
                        const data = message.smpl_mesh[0];
                        self.smplViewerState.meshData = data;
                        self.smplViewerState.currentFrame = 0;

                        // Center camera on first frame mesh
                        if (data.vertices && data.vertices.length > 0) {
                            self.smplViewerState.camera.target = computeMeshCenter(data.vertices[0]);
                        }

                        frameSlider.max = data.frames - 1;
                        frameSlider.disabled = false;
                        playButton.disabled = false;
                        self.updateSMPLFrame();
                    }
                };

                // Draw placeholder
                this.redrawSMPLCanvas();

                container.style.height = "600px";
                this.setSize([Math.max(400, this.size[0] || 400), 680]);

                return result;
            };

            // Update frame display
            nodeType.prototype.updateSMPLFrame = function() {
                const state = this.smplViewerState;
                if (!state.meshData) return;
                state.frameCounter.textContent = `Frame ${state.currentFrame + 1} / ${state.meshData.frames}`;
                state.frameSlider.value = state.currentFrame;
                this.redrawSMPLCanvas();
            };

            // Animation loop
            nodeType.prototype.animateSMPL = function() {
                const state = this.smplViewerState;
                if (!state.isPlaying || !state.meshData) return;

                const now = performance.now();
                const elapsed = now - state.lastFrameTime;
                const frameDuration = 1000 / state.meshData.fps;

                if (elapsed >= frameDuration) {
                    state.currentFrame = (state.currentFrame + 1) % state.meshData.frames;
                    this.updateSMPLFrame();
                    state.lastFrameTime = now - (elapsed % frameDuration);
                }

                requestAnimationFrame(() => this.animateSMPL());
            };

            // Render mesh
            nodeType.prototype.redrawSMPLCanvas = function() {
                const state = this.smplViewerState;
                const {canvas, ctx, meshData, currentFrame, camera} = state;

                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                if (!meshData) {
                    ctx.fillStyle = "#666";
                    ctx.font = "16px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("Waiting for SMPL data...", canvas.width / 2, canvas.height / 2);
                    ctx.fillText("Connect SMPL params from GVHMR Inference", canvas.width / 2, canvas.height / 2 + 25);
                    return;
                }

                // Draw grid
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 1;
                for (let i = -2; i <= 2; i++) {
                    const p1 = project3D([i, 0, -2], camera);
                    const p2 = project3D([i, 0, 2], camera);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();

                    const p3 = project3D([-2, 0, i], camera);
                    const p4 = project3D([2, 0, i], camera);
                    ctx.beginPath();
                    ctx.moveTo(p3.x, p3.y);
                    ctx.lineTo(p4.x, p4.y);
                    ctx.stroke();
                }

                const vertices = meshData.vertices[currentFrame];
                const faces = meshData.faces;

                const projected = vertices.map(v => project3D(v, camera));

                const facesWithDepth = faces.map(face => {
                    const avgZ = (projected[face[0]].z + projected[face[1]].z + projected[face[2]].z) / 3;
                    return {face, depth: avgZ};
                });
                facesWithDepth.sort((a, b) => a.depth - b.depth);

                ctx.strokeStyle = meshData.mesh_color || "#4a9eff";
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.5;

                for (const {face} of facesWithDepth) {
                    const v0 = projected[face[0]];
                    const v1 = projected[face[1]];
                    const v2 = projected[face[2]];

                    ctx.beginPath();
                    ctx.moveTo(v0.x, v0.y);
                    ctx.lineTo(v1.x, v1.y);
                    ctx.lineTo(v2.x, v2.y);
                    ctx.closePath();
                    ctx.stroke();
                }

                ctx.globalAlpha = 1.0;
            };
        }
    });

    console.log(`${config.logPrefix} Extension registered: ${config.extensionName}`);
}

// Auto-register all known SMPL viewer node types
SMPL_VIEWER_NODES.forEach(config => createSMPLViewerExtension(config));

export { createSMPLViewerExtension };
