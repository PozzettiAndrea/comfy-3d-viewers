/**
 * File List Updater Extension
 * Automatically refreshes file lists when source_folder changes
 * Used by nodes that need dynamic file listing (LoadSMPL, LoadFBXCharacter, etc.)
 */

import { app } from "../../../../scripts/app.js";

console.log("[FileListUpdater] Loading File List Updater extension");

// Node configurations for file list updating
const FILE_LIST_NODES = [
    {
        nodeName: "LoadSMPL",
        fileWidgetName: "npz_file",
        apiRoute: "/motioncapture/npz_files"
    },
    {
        nodeName: "LoadFBXCharacter",
        fileWidgetName: "fbx_file",
        apiRoute: "/motioncapture/fbx_files"
    }
];

/**
 * Refresh a COMBO widget by fetching new data from API
 */
async function refreshFileList(fileWidget, apiRoute, sourceFolder) {
    try {
        const url = `${apiRoute}?source_folder=${sourceFolder}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const files = await response.json();

        // Update widget options
        fileWidget.options.values = files;

        // Set value to first file or empty string
        if (files.length > 0) {
            // Keep current value if it exists in new list, otherwise select first
            if (!files.includes(fileWidget.value)) {
                fileWidget.value = files[0];
            }
        } else {
            fileWidget.value = "";
        }

    } catch (error) {
        console.error("[FileListUpdater] ERROR in refreshFileList:", error);
    }
}

/**
 * Setup dynamic file list for a node
 */
function setupDynamicFileList(node, nodeConfig) {
    const { fileWidgetName, apiRoute } = nodeConfig;

    // Find widgets
    const sourceFolderWidget = node.widgets?.find(w => w.name === "source_folder");
    const fileWidget = node.widgets?.find(w => w.name === fileWidgetName);

    if (!sourceFolderWidget) {
        console.error(`[FileListUpdater] Could not find source_folder widget`);
        return;
    }

    if (!fileWidget) {
        console.error(`[FileListUpdater] Could not find ${fileWidgetName} widget`);
        return;
    }

    // Store original callback if it exists
    const originalCallback = sourceFolderWidget.callback;

    // Override callback to refresh file list when source_folder changes
    sourceFolderWidget.callback = function(value) {
        // Call original callback if it exists
        if (originalCallback) {
            originalCallback.apply(this, arguments);
        }

        // Refresh the file list
        refreshFileList(fileWidget, apiRoute, value);
    };

    // Initial load - fetch files for current source_folder value
    setTimeout(() => {
        if (fileWidget && sourceFolderWidget) {
            refreshFileList(fileWidget, apiRoute, sourceFolderWidget.value);
        }
    }, 10);
}

// Register extension
app.registerExtension({
    name: "comfy3d.filelistupdater",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // Check if this node type needs file list updating
        const nodeConfig = FILE_LIST_NODES.find(c => c.nodeName === nodeData.name);
        if (!nodeConfig) return;

        console.log(`[FileListUpdater] Registering for ${nodeData.name}`);

        const onNodeCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function() {
            const result = onNodeCreated?.apply(this, arguments);

            // Setup dynamic file list updating
            setupDynamicFileList(this, nodeConfig);

            return result;
        };
    }
});

console.log("[FileListUpdater] Extension registered");

export { refreshFileList, setupDynamicFileList, FILE_LIST_NODES };
