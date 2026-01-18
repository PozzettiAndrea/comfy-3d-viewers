/**
 * ComfyUI GeomPack - Generic Text Report Renderer
 * Handles text output display for nodes that output plain text info/reports
 */

import { app } from "../../../scripts/app.js";
import { createAnalysisPanel, createWidgetOptions } from "./utils/uiComponents.js";
import { buildTextReportHTML } from "./utils/analysisPanel.js";

// Nodes that display text reports
const TEXT_REPORT_NODES = [
    "GeomPackMeshInfo",
    "GeomPackMeshQuality",
    "GeomPackFillHoles",
    "GeomPackTextureToGeometry",
    "GeomPackPointToMeshDistance",
    "GeomPackReconstructSurface",
    "GeomPackMeshToMeshDistance",
    "GeomPackRemesh",
    "GeomPackRefineMesh"
];

app.registerExtension({
    name: "geompack.text_report",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (!TEXT_REPORT_NODES.includes(nodeData.name)) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const r = onNodeCreated?.apply(this, arguments);

            // Create panel
            const infoPanel = createAnalysisPanel("Run workflow to see results");
            const widget = this.addDOMWidget("report_info", "REPORT_INFO", infoPanel, createWidgetOptions());
            widget.computeSize = () => [this.size[0] - 20, 150];

            // Handle execution results
            const onExecuted = this.onExecuted;
            this.onExecuted = function(message) {
                onExecuted?.apply(this, arguments);

                if (message?.text && message.text.length > 0) {
                    const text = message.text[0];
                    infoPanel.innerHTML = buildTextReportHTML(text);

                    // Dynamic height based on line count
                    const lineCount = (text.match(/\n/g) || []).length + 1;
                    const height = Math.min(Math.max(80, lineCount * 14 + 20), 300);
                    widget.computeSize = () => [this.size[0] - 20, height];
                    this.setDirtyCanvas(true);
                }
            };

            return r;
        };
    }
});
