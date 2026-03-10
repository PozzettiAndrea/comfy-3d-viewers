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

const SETTINGS_KEYS = ['edge_visibility', 'outline_visibility', 'grid_visibility',
                       'axis_visibility', 'parallel_projection'];

app.registerExtension({
    name: "pyvista.preview",

    async setup() {
        // Register yellow color for PYVISTA type links and slots.
        // ComfyUI's palette system overwrites link_type_colors on theme load,
        // so we use Object.defineProperty to make our color sticky.
        const PYVISTA_COLOR = "#e5c100";
        const PLOTTER_COLOR = "#d4a017";
        function lockColor(obj) {
            if (!obj) return;
            for (const [type, color] of [["PYVISTA", PYVISTA_COLOR], ["PV_PLOTTER", PLOTTER_COLOR]]) {
                Object.defineProperty(obj, type, {
                    get() { return color; },
                    set() {},
                    configurable: true,
                    enumerable: true,
                });
            }
        }
        function registerColor() {
            if (app.canvas?.constructor?.link_type_colors) {
                lockColor(app.canvas.constructor.link_type_colors);
            }
            if (window.LGraphCanvas?.link_type_colors) {
                lockColor(window.LGraphCanvas.link_type_colors);
            }
            if (app.canvas?.default_connection_color_byType) {
                lockColor(app.canvas.default_connection_color_byType);
            }
        }
        registerColor();
        setTimeout(registerColor, 500);
        setTimeout(registerColor, 2000);
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PyVistaPreview" || nodeData.name === "PyVistaPreviewPlotter") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                // Viewer state persisted via DOM widget serialization
                const viewerState = {
                    show_edges: false,
                    camera_state: "",        // static viewer camera (legacy)
                    camera_position: "",     // trame viewer camera
                    selected_field: "",
                    viewer_mode: "",
                    // Trame UI toggle settings
                    edge_visibility: false,
                    outline_visibility: false,
                    grid_visibility: false,
                    axis_visibility: true,
                    parallel_projection: false,
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

                // Listen for WIDGET_UPDATE from iframe (static viewer + trame settings bridge)
                window.addEventListener('message', (event) => {
                    if (event.data?.type === 'WIDGET_UPDATE') {
                        const { widget: name, value } = event.data;
                        if (name in viewerState) {
                            console.log('[PyVista] WIDGET_UPDATE:', name, '=', value);
                            viewerState[name] = value;
                        }
                    }
                });

                // Create viewer manager for handling iframe loads (static mode)
                const viewerManager = createViewerManager(iframe, "[PyVista]");

                // Listen for screenshot and error messages
                window.addEventListener('message', createScreenshotHandler('pyvista-screenshot'));
                window.addEventListener('message', createErrorHandler(infoPanel, "[PyVista]"));

                this.setSize([512, 640]);

                // Track active trame bridge polling interval
                let _bridgeInterval = null;

                // Listen for SETTINGS_BRIDGE_READY from injected iframe script
                window.addEventListener('message', (event) => {
                    if (event.data?.type === 'SETTINGS_BRIDGE_READY' && event.source === iframe.contentWindow) {
                        console.log('[PyVista] SETTINGS_BRIDGE_READY received');
                        // Send saved settings to iframe for restoration
                        const settings = {};
                        for (const name of SETTINGS_KEYS) {
                            if (viewerState[name] !== undefined) {
                                settings[name] = viewerState[name];
                            }
                        }
                        console.log('[PyVista] Sending RESTORE_SETTINGS:', settings);
                        iframe.contentWindow.postMessage({
                            type: 'RESTORE_SETTINGS',
                            settings: settings,
                        }, '*');
                    }
                });

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
                        // --- Trame mode ---
                        const trameUrl = message.trame_url[0];
                        const trameNodeId = message?.trame_node_id?.[0] || "";
                        viewerState.viewer_mode = "trame";

                        // Stop previous bridge polling
                        if (_bridgeInterval) {
                            clearInterval(_bridgeInterval);
                            _bridgeInterval = null;
                        }

                        iframe.src = trameUrl;

                        // After iframe loads, start camera bridge + inject settings bridge
                        iframe.onload = () => {
                            _bridgeInterval = _startTrameBridge(iframe, viewerState, trameNodeId);
                            _injectSettingsBridge(iframe);
                        };

                    } else if (message?.mesh_file && message.mesh_file[0]) {
                        // --- Static VTK.js fallback ---
                        const filename = message.mesh_file[0];
                        viewerState.viewer_mode = "static";

                        if (_bridgeInterval) {
                            clearInterval(_bridgeInterval);
                            _bridgeInterval = null;
                        }

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

// ---------------------------------------------------------------------------
// Trame bridge: runs entirely in the PARENT frame, directly accessing
// the same-origin iframe's Vue app. No script injection needed.
// ---------------------------------------------------------------------------

/**
 * Find the VtkLocalView component in the iframe's Vue app.
 * Returns { component, prefix } where prefix is the trame state namespace
 * (e.g. "P_0x..._0_") derived from the ref name, or null if not found.
 */
function _findVtkView(iframeDoc) {
    const appEl = iframeDoc.querySelector('#app');
    if (!appEl || !appEl.__vue_app__) return null;
    const vueApp = appEl.__vue_app__;

    // Strategy 1: trame provides.refs — also extracts prefix from ref name
    const trame = vueApp._context?.provides?.trame;
    if (trame?.refs) {
        for (const key of Object.keys(trame.refs)) {
            const ref = trame.refs[key];
            if (ref && typeof ref.getCamera === 'function') {
                // Ref name is "view_P_0x..._0", state prefix is "P_0x..._0_"
                const prefix = key.startsWith('view_') ? key.slice(5) + '_' : '';
                return { component: ref, prefix };
            }
        }
    }

    // Strategy 2: Walk vnode tree (no prefix available)
    if (vueApp._container?._vnode) {
        const found = _walkVnodeTree(vueApp._container._vnode, 0);
        if (found) return { component: found, prefix: '' };
    }

    return null;
}

function _walkVnodeTree(vnode, depth) {
    if (!vnode || depth > 15) return null;
    if (vnode.component) {
        const inst = vnode.component;
        if (inst.exposed && typeof inst.exposed.getCamera === 'function') return inst.exposed;
        if (inst.proxy && typeof inst.proxy.getCamera === 'function') return inst.proxy;
        if (inst.refs) {
            for (const k of Object.keys(inst.refs)) {
                if (inst.refs[k] && typeof inst.refs[k].getCamera === 'function') return inst.refs[k];
            }
        }
        if (inst.subTree) {
            const r = _walkVnodeTree(inst.subTree, depth + 1);
            if (r) return r;
        }
    }
    if (Array.isArray(vnode.children)) {
        for (const child of vnode.children) {
            const r = _walkVnodeTree(child, depth + 1);
            if (r) return r;
        }
    }
    return null;
}

/**
 * Start the trame camera bridge. Runs in the parent frame with direct access
 * to the iframe's DOM (same-origin). Handles camera restore + polling only.
 * Returns the polling interval ID.
 */
function _startTrameBridge(iframe, viewerState, nodeId) {
    let view = null;
    let lastCamJson = '';
    let cameraRestored = false;
    let retryCount = 0;
    const MAX_RETRIES = 30;

    const intervalId = setInterval(() => {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;

            if (!view) {
                view = _findVtkView(doc);
                if (!view) {
                    if (++retryCount >= MAX_RETRIES) clearInterval(intervalId);
                    return;
                }
                try {
                    const cam = view.component.getCamera();
                    if (cam) lastCamJson = JSON.stringify(cam);
                } catch(e) {}
            }

            const { component } = view;

            // Restore camera once
            if (!cameraRestored && viewerState.camera_position) {
                try {
                    const cam = typeof viewerState.camera_position === 'string'
                        ? JSON.parse(viewerState.camera_position) : viewerState.camera_position;
                    component.setCamera(cam);
                    lastCamJson = JSON.stringify(component.getCamera());
                    cameraRestored = true;
                } catch(e) {
                    cameraRestored = true;
                }
            }

            // Poll for camera changes
            try {
                const cam = component.getCamera();
                if (cam) {
                    const json = JSON.stringify(cam);
                    if (json !== lastCamJson && lastCamJson !== '') {
                        viewerState.camera_position = json;
                        fetch('/trame/api/save_camera', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ node_id: nodeId, camera_position: cam })
                        }).catch(() => {});
                    }
                    lastCamJson = json;
                }
            } catch(e) {}
        } catch(e) {}
    }, 500);

    return intervalId;
}

/**
 * Inject a settings bridge script into the trame iframe.
 * Runs natively in the iframe's JS context where Vue reactivity works.
 * Syncs trame UI toggle settings (edges, grid, outline, axis, projection)
 * back to the parent frame via postMessage.
 */
function _injectSettingsBridge(iframe) {
    try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        const script = doc.createElement('script');
        script.textContent = `
(function() {
    var SETTINGS = ${JSON.stringify(SETTINGS_KEYS)};
    var POLL_MS = 500;
    var MAX_WAIT = 15000;
    var startTime = Date.now();

    function init() {
        var appEl = document.querySelector('#app');
        if (!appEl || !appEl.__vue_app__) {
            console.log('[SettingsBridge] Waiting for Vue app...');
            if (Date.now() - startTime < MAX_WAIT) setTimeout(init, POLL_MS);
            return;
        }
        var vueApp = appEl.__vue_app__;
        var trame = vueApp._context && vueApp._context.provides && vueApp._context.provides.trame;
        if (!trame) {
            console.log('[SettingsBridge] Waiting for trame provides...');
            if (Date.now() - startTime < MAX_WAIT) setTimeout(init, POLL_MS);
            return;
        }

        // Derive prefix from trame refs (same strategy as parent _findVtkView)
        var prefix = '';
        if (trame.refs) {
            var refKeys = Object.keys(trame.refs);
            console.log('[SettingsBridge] trame.refs keys:', refKeys);
            for (var i = 0; i < refKeys.length; i++) {
                var key = refKeys[i];
                var ref = trame.refs[key];
                if (ref && typeof ref.getCamera === 'function') {
                    if (key.indexOf('view_') === 0) prefix = key.slice(5) + '_';
                    break;
                }
            }
        }

        if (!prefix) {
            console.log('[SettingsBridge] No prefix found, retrying...');
            if (Date.now() - startTime < MAX_WAIT) setTimeout(init, 2000);
            return;
        }

        var state = trame.state;
        console.log('[SettingsBridge] Initialized. prefix=' + prefix);
        console.log('[SettingsBridge] state.get available:', typeof state.get);
        console.log('[SettingsBridge] state.set available:', typeof state.set);
        console.log('[SettingsBridge] Test read: ' + prefix + 'edge_visibility =', state.get(prefix + 'edge_visibility'));

        // Poll settings using state.get() and send changes to parent
        var lastSettings = {};
        setInterval(function() {
            for (var i = 0; i < SETTINGS.length; i++) {
                var name = SETTINGS[i];
                var val = state.get(prefix + name);
                if (val !== undefined && val !== lastSettings[name]) {
                    lastSettings[name] = val;
                    console.log('[SettingsBridge] Change detected:', name, '=', val);
                    window.parent.postMessage(
                        { type: 'WIDGET_UPDATE', widget: name, value: val }, '*'
                    );
                }
            }
        }, POLL_MS);

        // Listen for settings restore from parent using state.set()
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'RESTORE_SETTINGS' && event.data.settings) {
                console.log('[SettingsBridge] Restoring settings:', event.data.settings);
                var s = event.data.settings;
                for (var i = 0; i < SETTINGS.length; i++) {
                    var name = SETTINGS[i];
                    if (s[name] !== undefined) {
                        state.set(prefix + name, s[name]);
                    }
                }
            }
        });

        // Signal ready to parent
        window.parent.postMessage({ type: 'SETTINGS_BRIDGE_READY' }, '*');
    }

    setTimeout(init, 1000);
})();
`;
        doc.head.appendChild(script);
    } catch(e) {
        console.error('[PyVista] Failed to inject settings bridge:', e);
    }
}
