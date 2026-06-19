// Load CAD: drag-n-drop / upload (with progress bar) for CADabra's CAD_Load.
// Mirrors GeometryPack's load_mesh_upload.js, adapted for CAD files:
//   - target node CAD_Load, combo widget "filename"
//   - uploads to ComfyUI's /upload/image with subfolder=cad (lands in input/cad/)
//   - the combo value is the input-relative path "cad/<filename>" (matching
//     CAD_Load's recursive scan); CAD_Load resolves it against the input folder.
import { app } from "../../../scripts/app.js";

const TAG = "[LoadCADUpload]";
console.log(`${TAG} script loaded`);

const EXTS = [".step", ".stp", ".iges", ".igs", ".brep"];
const ACCEPT = EXTS.join(",");
const isCad = (name) => EXTS.some((x) => name.toLowerCase().endsWith(x));

// XHR upload so we can report upload progress. Returns the input-relative path
// "cad/<filename>" to match what CAD_Load / _get_cad_files list.
function uploadCad(file, onProgress) {
    return new Promise((resolve, reject) => {
        const body = new FormData();
        body.append("image", file, file.name);   // ComfyUI's endpoint keys the file as "image"
        body.append("subfolder", "cad");
        body.append("type", "input");
        body.append("overwrite", "true");
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/upload/image");
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total, e.loaded, e.total);
        };
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const d = JSON.parse(xhr.responseText);
                    const sub = (d.subfolder || "").replace(/\\/g, "/");
                    resolve(sub ? `${sub}/${d.name}` : d.name);  // e.g. "cad/foo.step"
                } catch (e) { reject(e); }
            } else {
                reject(new Error(`${xhr.status} ${xhr.responseText}`));
            }
        };
        xhr.onerror = () => reject(new Error("network error"));
        if (onProgress) onProgress(0, 0, file.size);
        xhr.send(body);
    });
}

function fileWidget(node) {
    return node.widgets?.find((x) => x.name === "filename");
}

function selectValue(node, val) {
    const w = fileWidget(node);
    if (!w) { console.warn(`${TAG} no filename widget`); return; }
    w.options = w.options || {};
    w.options.values = w.options.values || [];
    // drop the "(no CAD files found ...)" placeholder if present
    w.options.values = w.options.values.filter((v) => !String(v).startsWith("(no CAD files found"));
    if (!w.options.values.includes(val)) w.options.values.push(val);
    w.value = val;
    try { w.callback?.(val); } catch (e) { /* noop */ }
    node.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "cadabra.loadcad.upload",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "CAD_Load") return;
        console.log(`${TAG} registering for CAD_Load`);

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onCreated?.apply(this, arguments);
            const node = this;

            // --- progress bar (DOM widget; collapses to 0 height when idle) ---
            const wrap = document.createElement("div");
            wrap.style.cssText = "width:100%;padding:0 6px;box-sizing:border-box;display:none;";
            const label = document.createElement("div");
            label.style.cssText = "font:10px monospace;color:#bbb;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
            const track = document.createElement("div");
            track.style.cssText = "width:100%;height:6px;background:rgba(255,255,255,0.18);border-radius:3px;overflow:hidden;";
            const bar = document.createElement("div");
            bar.style.cssText = "width:0%;height:100%;background:#00c8ff;transition:width 0.1s linear;";
            track.appendChild(bar); wrap.appendChild(label); wrap.appendChild(track);
            const progWidget = node.addDOMWidget("upload_progress", "div", wrap, {
                getValue() { return ""; }, setValue() { },
            });
            progWidget.computeSize = (w) => (wrap.style.display === "none" ? [w, 0] : [w, 26]);
            const showProgress = (name, frac) => {
                wrap.style.display = "block";
                const pct = Math.max(0, Math.min(100, Math.round((frac || 0) * 100)));
                label.textContent = `⬆ ${name} — ${pct}%`;
                bar.style.width = pct + "%";
                node.setDirtyCanvas(true, true);
            };
            const hideProgress = () => { wrap.style.display = "none"; node.setDirtyCanvas(true, true); };

            async function uploadList(files) {
                const cads = [...files].filter((f) => isCad(f.name));
                if (!cads.length) { console.warn(`${TAG} no CAD files in selection/drop`); return false; }
                for (const f of cads) {
                    try {
                        showProgress(f.name, 0);
                        const val = await uploadCad(f, (frac) => showProgress(f.name, frac));
                        selectValue(node, val);
                        console.log(`${TAG} uploaded -> ${val}`);
                    } catch (e) {
                        console.error(`${TAG} upload failed for ${f.name}`, e);
                        alert("CAD upload failed: " + e.message);
                    } finally {
                        hideProgress();
                    }
                }
                return true;
            }
            node._cadUploadList = uploadList;

            // hidden file picker + upload button
            const input = document.createElement("input");
            input.type = "file"; input.accept = ACCEPT; input.multiple = true; input.style.display = "none";
            input.addEventListener("change", async () => { await uploadList(input.files); input.value = ""; });
            document.body.appendChild(input);
            node.addWidget("button", "⬆ upload / drop CAD", null, () => { console.log(`${TAG} upload button clicked`); input.click(); });

            return r;
        };

        // --- drag-n-drop onto the node ---
        const onDragOver = nodeType.prototype.onDragOver;
        nodeType.prototype.onDragOver = function (e) {
            if ([...(e?.dataTransfer?.items || [])].some((it) => it.kind === "file")) return true;
            return onDragOver?.apply(this, arguments) ?? false;
        };
        const onDragDrop = nodeType.prototype.onDragDrop;
        nodeType.prototype.onDragDrop = async function (e) {
            console.log(`${TAG} drop; files=${e?.dataTransfer?.files?.length}`);
            if (this._cadUploadList && await this._cadUploadList(e?.dataTransfer?.files || [])) return true;
            return onDragDrop?.apply(this, arguments) ?? false;
        };
    },
});
