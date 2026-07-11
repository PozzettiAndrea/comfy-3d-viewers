// Collapsible info box for the CADabra "Load CAD From Glob" node: shows the
// glob pattern, match/load/fail counts, and the loaded filenames, returned
// via ui={"text":[...]} after each run. Collapsed by default since the file
// list can get long for large batches.
import { app } from "../../../scripts/app.js";

const TAG = "[CADLoadGlobInfo]";
const COLLAPSED_HEIGHT = 26;
const EXPANDED_HEIGHT = 160;

app.registerExtension({
    name: "cadabra.cadloadglob.info",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "CAD_Load_From_Glob") return;

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            const t = message?.text;
            const text = Array.isArray(t) ? t.join("\n") : (t || "");
            const summary = text.split("\n").find((l) => l.startsWith("Matched:")) || "Load info";

            let w = this.widgets?.find((x) => x.name === "load_info");
            if (!w) {
                let expanded = false;

                const container = document.createElement("div");
                container.style.cssText = "width:100%;height:100%;box-sizing:border-box;";

                const header = document.createElement("div");
                header.style.cssText =
                    "width:100%;box-sizing:border-box;background:#222;color:#ccc;border:1px solid #333;" +
                    "border-radius:4px;font:11px/1.4 monospace;padding:4px 6px;cursor:pointer;" +
                    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:none;";

                const ta = document.createElement("textarea");
                ta.readOnly = true;
                ta.style.cssText =
                    "width:100%;height:132px;box-sizing:border-box;background:#1a1a1a;color:#ccc;" +
                    "border:1px solid #333;border-top:none;border-radius:0 0 4px 4px;font:11px/1.4 monospace;" +
                    "padding:6px;resize:none;display:none;";

                header.addEventListener("click", () => {
                    expanded = !expanded;
                    ta.style.display = expanded ? "block" : "none";
                    header.textContent = (expanded ? "▾ " : "▸ ") + header.dataset.summary;
                    w.computeSize = (width) => [width, expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT];
                    this.setSize([this.size[0], this.size[1]]);
                    this.setDirtyCanvas(true, true);
                });

                container.appendChild(header);
                container.appendChild(ta);

                w = this.addDOMWidget("load_info", "div", container, {
                    getValue() { return ta.value; },
                    setValue(v) { ta.value = v; },
                    serialize: false,
                });
                w.computeSize = (width) => [width, COLLAPSED_HEIGHT];
                w._header = header;
                w._textarea = ta;
            }

            w._textarea.value = text;
            w._header.dataset.summary = summary;
            w._header.textContent = (w._textarea.style.display === "block" ? "▾ " : "▸ ") + summary;
            console.log(`${TAG} updated (${text.length} chars)`);
            this.setDirtyCanvas(true, true);
        };
    },
});
