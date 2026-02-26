/**
 * ComfyUI-PyVista — Preview node widget
 * Embeds a trame PyVistaLocalView or falls back to static vtk.js viewer.
 */

import { app } from "../../../scripts/app.js";
import { EXTENSION_FOLDER, getViewerUrl } from "./utils/extensionFolder.js";
import { createContainer, createIframe, createInfoPanel } from "./utils/uiComponents.js";
import { buildMeshInfoHTML } from "./utils/formatting.js";
import { createScreenshotHandler } from "./utils/screenshot.js";
import { createViewerManager, createErrorHandler, buildViewUrl } from "./utils/postMessage.js";

app.registerExtension({
    name: "pyvista.preview",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PyVistaPreview") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                // Viewer state persisted via DOM widget serialization
                const viewerState = {
                    show_edges: false,
                    camera_state: "",        // static viewer camera (legacy)
                    camera_position: "",     // trame viewer camera (position/focalPoint/viewUp)
                    selected_field: "",
                    viewer_mode: "",
                };

                // Create container, iframe, and info panel
                const container = createContainer({ backgroundColor: "#3b3b3b" });
                const iframe = createIframe(getViewerUrl("viewer_pyvista"), { backgroundColor: "#3b3b3b" });
                const infoPanel = createInfoPanel("Run workflow to preview mesh", {
                    backgroundColor: "#2e2e2e",
                    borderTop: "1px solid #555",
                    color: "#ddd",
                });

                container.appendChild(iframe);
                container.appendChild(infoPanel);

                // Register DOM widget
                const widget = this.addDOMWidget("preview_pyvista", "PYVISTA_PREVIEW", container, {
                    getValue() { return JSON.stringify(viewerState); },
                    setValue(v) {
                        try { Object.assign(viewerState, JSON.parse(v)); } catch(e) {}
                    }
                });
                widget.computeSize = () => [512, 640];

                this.meshViewerIframe = iframe;
                this.meshInfoPanel = infoPanel;

                this.setSize(this.computeSize());

                // Bidirectional sync: viewer -> node widgets (both static and trame modes)
                const node = this;
                window.addEventListener('message', (event) => {
                    if (event.data.type === 'WIDGET_UPDATE') {
                        const { widget: name, value } = event.data;
                        if (name in viewerState) viewerState[name] = value;
                        const w = node.widgets?.find(w => w.name === name);
                        if (w) w.value = value;
                    }
                    // When camera bridge inside trame iframe is ready, restore saved camera
                    if (event.data.type === 'CAMERA_BRIDGE_READY' && viewerState.camera_position && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({
                            type: 'RESTORE_CAMERA',
                            camera: viewerState.camera_position,
                        }, '*');
                    }
                });

                // Create viewer manager for handling iframe loads (static mode)
                const viewerManager = createViewerManager(iframe, "[PyVista]");

                // Listen for screenshot and error messages
                window.addEventListener('message', createScreenshotHandler('pyvista-screenshot'));
                window.addEventListener('message', createErrorHandler(infoPanel, "[PyVista]"));

                this.setSize([512, 640]);

                // Handle execution
                const onExecuted = this.onExecuted;
                this.onExecuted = function(message) {
                    onExecuted?.apply(this, arguments);

                    const viewerMode = message?.viewer_mode?.[0] || "static";

                    // Build info HTML (shared for both modes)
                    const mode = message?.viewer_type?.[0] || "fields";
                    const infoHTML = buildMeshInfoHTML({
                        mode: mode,
                        vertices: message?.vertex_count?.[0] || 'N/A',
                        faces: message?.face_count?.[0] || 'N/A',
                        boundsMin: message?.bounds_min?.[0] || [],
                        boundsMax: message?.bounds_max?.[0] || [],
                        extents: message?.extents?.[0] || [],
                        fieldNames: message?.field_names?.[0] || [],
                    });
                    infoPanel.innerHTML = infoHTML;

                    if (viewerMode === "trame" && message?.trame_url?.[0]) {
                        // --- Trame mode: point iframe at reverse-proxied trame server ---
                        const trameUrl = message.trame_url[0];
                        const trameNodeId = message?.trame_node_id?.[0] || "";
                        viewerState.viewer_mode = "trame";

                        // Always reload to pick up new scene from re-execution
                        iframe.src = trameUrl;

                        // Inject camera bridge into same-origin trame iframe after it loads
                        iframe.onload = () => {
                            setTimeout(() => {
                                _injectCameraBridge(iframe, viewerState, trameNodeId);
                            }, 2000);
                        };

                    } else if (message?.mesh_file && message.mesh_file[0]) {
                        // --- Static VTK.js fallback ---
                        const filename = message.mesh_file[0];

                        viewerState.viewer_mode = "static";

                        const filepath = buildViewUrl(filename);
                        const messageData = {
                            type: "LOAD_MESH",
                            filepath: filepath,
                            timestamp: Date.now(),
                            showEdges: viewerState.show_edges,
                            cameraState: viewerState.camera_state,
                            selectedField: viewerState.selected_field,
                        };

                        viewerManager.switchViewer("pyvista", getViewerUrl("viewer_pyvista"), messageData);
                    }
                };

                return r;
            };
        }
    }
});

/**
 * Inject camera bridge script into the same-origin trame iframe.
 * Uses createElement+textContent+appendChild which guarantees execution.
 * The script finds the VtkLocalView Vue component via $refs, hooks canvas
 * events to capture camera, and listens for RESTORE_CAMERA to restore it.
 */
function _injectCameraBridge(iframe, viewerState, nodeId) {
    console.log('[PyVista] _injectCameraBridge called, nodeId=' + nodeId);
    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        console.log('[PyVista] iframe.contentDocument:', doc ? 'OK' : 'null');
        if (!doc) return;

        // Remove any previously injected bridge
        const old = doc.getElementById('comfyui-camera-bridge');
        if (old) old.remove();

        const script = doc.createElement('script');
        script.id = 'comfyui-camera-bridge';
        script.textContent = `
(function() {
    var NODE_ID = ${JSON.stringify(nodeId)};
    var POLL_MS = 500;
    var MAX_WAIT = 15000;
    var startTime = Date.now();

    function init() {
        // Find VtkLocalView component via Vue app refs
        var appEl = document.querySelector('#app');
        if (!appEl || !appEl.__vue_app__) {
            if (Date.now() - startTime < MAX_WAIT) setTimeout(init, POLL_MS);
            return;
        }
        var vm = appEl.__vue_app__._instance;
        var refs = vm && vm.proxy && vm.proxy.$refs;
        if (!refs) {
            if (Date.now() - startTime < MAX_WAIT) setTimeout(init, POLL_MS);
            return;
        }

        // Find the VtkLocalView ref (starts with "view_")
        var component = null;
        for (var key in refs) {
            if (key.startsWith('view_') && refs[key] && refs[key].getCamera) {
                component = refs[key];
                break;
            }
        }
        if (!component) {
            if (Date.now() - startTime < MAX_WAIT) setTimeout(init, POLL_MS);
            return;
        }

        console.log('[CameraBridge] Found VtkLocalView component');

        // Hook canvas interaction events to capture camera state
        var canvas = document.querySelector('canvas');
        if (canvas) {
            var timer = null;
            var sendCamera = function() {
                try {
                    var cam = component.getCamera();
                    if (cam) {
                        var val = JSON.stringify(cam);
                        window.parent.postMessage(
                            { type: 'WIDGET_UPDATE', widget: 'camera_position', value: val },
                            '*'
                        );
                        // Also save to server for cross-execution persistence
                        fetch('/trame/api/save_camera', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ node_id: NODE_ID, camera_position: cam })
                        }).catch(function() {});
                    }
                } catch(e) { console.warn('[CameraBridge] sendCamera error:', e); }
            };
            canvas.addEventListener('mouseup', function() { clearTimeout(timer); timer = setTimeout(sendCamera, 300); });
            canvas.addEventListener('wheel', function() { clearTimeout(timer); timer = setTimeout(sendCamera, 300); });
            canvas.addEventListener('touchend', function() { clearTimeout(timer); timer = setTimeout(sendCamera, 300); });
        }

        // Listen for camera restore from parent
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'RESTORE_CAMERA' && event.data.camera) {
                try {
                    var cam = typeof event.data.camera === 'string'
                        ? JSON.parse(event.data.camera) : event.data.camera;
                    component.setCamera(cam);
                    console.log('[CameraBridge] Camera restored');
                } catch(e) { console.warn('[CameraBridge] Restore failed:', e); }
            }
        });

        // Signal readiness to parent
        window.parent.postMessage({ type: 'CAMERA_BRIDGE_READY' }, '*');
        console.log('[CameraBridge] Initialized, node=' + NODE_ID);
    }

    setTimeout(init, 1000);
})();
`;
        doc.head.appendChild(script);
    } catch(e) {
        console.warn('[PyVista] Failed to inject camera bridge:', e);
    }
}
