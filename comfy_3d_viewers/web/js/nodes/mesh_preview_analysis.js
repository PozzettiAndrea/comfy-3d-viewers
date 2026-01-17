/**
 * ComfyUI GeomPack - Mesh Analysis Preview Widget
 * VTK.js viewer with analysis buttons for open edges, components, self-intersections
 */

import { app } from "../../../scripts/app.js";

// Auto-detect extension folder name
const EXTENSION_FOLDER = (() => {
    const url = import.meta.url;
    const match = url.match(/\/extensions\/([^/]+)\//);
    return match ? match[1] : "ComfyUI-GeometryPack";
})();

app.registerExtension({
    name: "geompack.meshpreview.analysis",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "GeomPackPreviewMeshAnalysis") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                // Store mesh info for API calls
                this.meshId = null;
                this.meshFilename = null;
                this.activeFields = [];

                // Create main container
                const container = document.createElement("div");
                container.style.width = "100%";
                container.style.height = "100%";
                container.style.display = "flex";
                container.style.flexDirection = "column";
                container.style.backgroundColor = "#2a2a2a";
                container.style.overflow = "hidden";

                // Create button bar
                const buttonBar = document.createElement("div");
                buttonBar.style.display = "flex";
                buttonBar.style.gap = "4px";
                buttonBar.style.padding = "6px";
                buttonBar.style.backgroundColor = "#1a1a1a";
                buttonBar.style.borderBottom = "1px solid #444";
                buttonBar.style.flexShrink = "0";

                // Analysis button style
                const buttonStyle = `
                    padding: 4px 8px;
                    font-size: 10px;
                    font-family: monospace;
                    border: 1px solid #555;
                    border-radius: 3px;
                    cursor: pointer;
                    transition: all 0.2s;
                `;

                // Create analysis buttons
                const analyses = [
                    { id: "open_edges", label: "Open Edges", color: "#f66", activeColor: "#f99" },
                    { id: "components", label: "Components", color: "#6cf", activeColor: "#9df" },
                    { id: "self_intersect", label: "Self-Intersect", color: "#fc6", activeColor: "#fd9" }
                ];

                const buttons = {};
                const node = this;

                // Create Find input (will be added after analysis buttons)
                const findInput = document.createElement("input");
                findInput.type = "text";
                findInput.placeholder = "f123, v456, (x,y,z)";
                findInput.style.cssText = `
                    width: 100px;
                    padding: 4px 6px;
                    font-size: 10px;
                    font-family: monospace;
                    border: 1px solid #555;
                    border-radius: 3px;
                    background-color: #2a2a2a;
                    color: #ccc;
                `;
                findInput.title = "Enter face ID (f123 or just 123), vertex ID (v456), or coordinates (x, y, z)";

                // Create Find button
                const findBtn = document.createElement("button");
                findBtn.textContent = "Find";
                findBtn.style.cssText = buttonStyle;
                findBtn.style.backgroundColor = "#363";
                findBtn.style.color = "#cfc";

                findBtn.addEventListener("mouseenter", () => {
                    findBtn.style.backgroundColor = "#484";
                });
                findBtn.addEventListener("mouseleave", () => {
                    findBtn.style.backgroundColor = "#363";
                });

                const doFind = async () => {
                    const query = findInput.value.trim();
                    if (!query) return;
                    if (!node.meshId) {
                        console.warn("[MeshAnalysis] No mesh loaded yet");
                        return;
                    }

                    findBtn.disabled = true;
                    findBtn.textContent = "...";

                    try {
                        const response = await fetch("/geompack/find_location", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                mesh_id: node.meshId,
                                query: query
                            })
                        });

                        const result = await response.json();

                        if (result.success) {
                            // Send message to viewer to focus on point
                            if (iframe.contentWindow) {
                                iframe.contentWindow.postMessage({
                                    type: "FOCUS_ON_POINT",
                                    point: result.point,
                                    timestamp: Date.now()
                                }, "*");
                            }

                            // Update input placeholder with result info
                            const typeLabel = result.type === "face" ? `f${result.id}` :
                                              result.type === "vertex" ? `v${result.id}` : "coord";
                            findBtn.textContent = typeLabel;
                            findBtn.style.backgroundColor = "#6a6";

                            console.log(`[MeshAnalysis] Found ${result.type}: ${result.point}`);
                        } else {
                            console.error(`[MeshAnalysis] Find error: ${result.error}`);
                            findBtn.textContent = "err";
                            findBtn.style.backgroundColor = "#a33";
                        }
                    } catch (e) {
                        console.error("[MeshAnalysis] Find API call failed:", e);
                        findBtn.textContent = "err";
                        findBtn.style.backgroundColor = "#a33";
                    } finally {
                        findBtn.disabled = false;
                        setTimeout(() => {
                            findBtn.textContent = "Find";
                            findBtn.style.backgroundColor = "#363";
                        }, 1500);
                    }
                };

                findBtn.addEventListener("click", doFind);
                findInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") doFind();
                });

                // Analysis buttons are added first, then spacer, then find controls
                analyses.forEach(analysis => {
                    const btn = document.createElement("button");
                    btn.textContent = analysis.label;
                    btn.style.cssText = buttonStyle;
                    btn.style.backgroundColor = "#333";
                    btn.style.color = "#ccc";
                    btn.dataset.analysisId = analysis.id;
                    btn.dataset.active = "false";

                    btn.addEventListener("mouseenter", () => {
                        if (btn.dataset.active !== "true") {
                            btn.style.backgroundColor = "#444";
                        }
                    });

                    btn.addEventListener("mouseleave", () => {
                        if (btn.dataset.active !== "true") {
                            btn.style.backgroundColor = "#333";
                        }
                    });

                    btn.addEventListener("click", async () => {
                        if (!node.meshId) {
                            console.warn("[MeshAnalysis] No mesh loaded yet");
                            return;
                        }

                        // Show loading state
                        btn.disabled = true;
                        btn.textContent = "...";

                        try {
                            const response = await fetch("/geompack/analyze", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    mesh_id: node.meshId,
                                    analysis_type: analysis.id
                                })
                            });

                            const result = await response.json();

                            if (result.success) {
                                // Mark button as active
                                btn.dataset.active = "true";
                                btn.style.backgroundColor = analysis.color;
                                btn.style.color = "#000";
                                btn.style.borderColor = analysis.activeColor;

                                // Update button text with count
                                btn.textContent = `${analysis.label} (${result.count})`;

                                // Track active field
                                if (!node.activeFields.includes(result.field_name)) {
                                    node.activeFields.push(result.field_name);
                                }

                                // Update info panel
                                updateInfoPanel();

                                // Reload mesh in viewer
                                const filepath = `/view?filename=${encodeURIComponent(result.filename)}&type=output&subfolder=`;
                                if (iframe.contentWindow) {
                                    iframe.contentWindow.postMessage({
                                        type: "LOAD_MESH",
                                        filepath: filepath,
                                        timestamp: Date.now()
                                    }, "*");
                                }

                                console.log(`[MeshAnalysis] ${analysis.id}: ${result.field_name} = ${result.count}`);
                            } else {
                                console.error(`[MeshAnalysis] Error: ${result.error}`);
                                btn.textContent = analysis.label + " (err)";
                            }
                        } catch (e) {
                            console.error("[MeshAnalysis] API call failed:", e);
                            btn.textContent = analysis.label + " (err)";
                        } finally {
                            btn.disabled = false;
                        }
                    });

                    buttons[analysis.id] = btn;
                    buttonBar.appendChild(btn);
                });

                // Add spacer to push Find controls to the right
                const spacer = document.createElement("div");
                spacer.style.flex = "1";
                buttonBar.appendChild(spacer);

                // Add Find controls
                buttonBar.appendChild(findInput);
                buttonBar.appendChild(findBtn);

                // Create iframe for VTK.js viewer
                const iframe = document.createElement("iframe");
                iframe.style.width = "100%";
                iframe.style.flex = "1 1 0";
                iframe.style.minHeight = "0";
                iframe.style.border = "none";
                iframe.style.backgroundColor = "#2a2a2a";
                iframe.src = `/extensions/${EXTENSION_FOLDER}/viewer_vtk.html?v=` + Date.now();

                // Track iframe load state
                let iframeLoaded = false;
                iframe.addEventListener('load', () => {
                    iframeLoaded = true;
                });

                // Create info panel
                const infoPanel = document.createElement("div");
                infoPanel.style.backgroundColor = "#1a1a1a";
                infoPanel.style.borderTop = "1px solid #444";
                infoPanel.style.padding = "6px 12px";
                infoPanel.style.fontSize = "10px";
                infoPanel.style.fontFamily = "monospace";
                infoPanel.style.color = "#ccc";
                infoPanel.style.lineHeight = "1.3";
                infoPanel.style.flexShrink = "0";
                infoPanel.style.overflow = "hidden";
                infoPanel.innerHTML = '<span style="color: #888;">Run workflow to load mesh, then click analysis buttons</span>';

                const updateInfoPanel = () => {
                    if (!node.meshInfo) return;

                    const info = node.meshInfo;
                    let fieldsHtml = node.activeFields.length > 0
                        ? `<span style="color: #6cf;">${node.activeFields.join(', ')}</span>`
                        : '<span style="color: #888;">None (click buttons above)</span>';

                    infoPanel.innerHTML = `
                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 2px 8px;">
                            <span style="color: #888;">Vertices:</span>
                            <span>${info.vertices.toLocaleString()}</span>
                            <span style="color: #888;">Faces:</span>
                            <span>${info.faces.toLocaleString()}</span>
                            <span style="color: #888;">Watertight:</span>
                            <span style="color: ${info.watertight ? '#6c6' : '#c66'};">${info.watertight ? 'Yes' : 'No'}</span>
                            <span style="color: #888;">Fields:</span>
                            ${fieldsHtml}
                        </div>
                    `;
                };

                // Assemble container
                container.appendChild(buttonBar);
                container.appendChild(iframe);
                container.appendChild(infoPanel);

                // Add widget
                const widget = this.addDOMWidget("preview_analysis", "MESH_PREVIEW_ANALYSIS", container, {
                    getValue() { return ""; },
                    setValue(v) { }
                });

                widget.computeSize = () => [512, 680];

                // Store references
                this.meshViewerIframe = iframe;
                this.meshInfoPanel = infoPanel;
                this.analysisButtons = buttons;
                this.updateInfoPanel = updateInfoPanel;

                // Set initial size
                this.setSize([512, 680]);

                // Handle execution
                const onExecuted = this.onExecuted;
                this.onExecuted = function(message) {
                    onExecuted?.apply(this, arguments);

                    if (message?.mesh_file && message.mesh_file[0]) {
                        const filename = message.mesh_file[0];
                        const meshId = message.mesh_id?.[0];

                        // Store mesh info
                        node.meshId = meshId;
                        node.meshFilename = filename;
                        node.activeFields = message.field_names?.[0] || [];

                        node.meshInfo = {
                            vertices: message.vertex_count?.[0] || 0,
                            faces: message.face_count?.[0] || 0,
                            watertight: message.is_watertight?.[0] || false
                        };

                        // Reset buttons
                        Object.values(buttons).forEach(btn => {
                            const analysis = analyses.find(a => a.id === btn.dataset.analysisId);
                            btn.dataset.active = "false";
                            btn.style.backgroundColor = "#333";
                            btn.style.color = "#ccc";
                            btn.style.borderColor = "#555";
                            btn.textContent = analysis.label;
                        });

                        // Update info panel
                        updateInfoPanel();

                        // Load mesh in viewer
                        const filepath = `/view?filename=${encodeURIComponent(filename)}&type=output&subfolder=`;

                        const sendMessage = () => {
                            if (iframe.contentWindow) {
                                iframe.contentWindow.postMessage({
                                    type: "LOAD_MESH",
                                    filepath: filepath,
                                    timestamp: Date.now()
                                }, "*");
                            }
                        };

                        if (iframeLoaded) {
                            sendMessage();
                        } else {
                            setTimeout(sendMessage, 500);
                        }
                    }
                };

                return r;
            };
        }
    }
});
