// Read-only info box for the CADabra "CAD Mesh" node: shows the `info` text
// (verts/faces, deflection, watertight + open-edge + B-rep free-edge diagnostics)
// returned via ui={"text":[...]} after each run.
import { app } from "../../../scripts/app.js";

const TAG = "[CADMeshInfo]";

app.registerExtension({
    name: "cadabra.cadmesh.info",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "CAD_Mesh") return;

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            const t = message?.text;
            const text = Array.isArray(t) ? t.join("\n") : (t || "");

            let w = this.widgets?.find((x) => x.name === "mesh_info");
            if (!w) {
                const ta = document.createElement("textarea");
                ta.readOnly = true;
                ta.style.cssText =
                    "width:100%;height:100%;box-sizing:border-box;background:#1a1a1a;color:#ccc;" +
                    "border:1px solid #333;border-radius:4px;font:11px/1.4 monospace;padding:6px;resize:none;";
                w = this.addDOMWidget("mesh_info", "textarea", ta, {
                    getValue() { return ta.value; },
                    setValue(v) { ta.value = v; },
                    serialize: false,
                });
                w.computeSize = (width) => [width, 132];
            }
            w.element.value = text;
            console.log(`${TAG} updated (${text.length} chars)`);
            this.setDirtyCanvas(true, true);
        };
    },
});
