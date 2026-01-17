# comfy-3d-viewers

Reusable 3D viewer infrastructure for ComfyUI nodes.

Provides VTK.js and Gaussian splatting viewers, shared utilities, and HTML templates for 3D mesh visualization in ComfyUI.

## Installation

```bash
pip install -e .
```

## Usage

This package is used by ComfyUI-GeometryPack. The `prestartup_script.py` copies the viewer files to the extension's web directory at runtime.

```python
from comfy_3d_viewers import get_js_dir, get_html_dir, get_utils_dir

# Get paths to viewer files
js_dir = get_js_dir()      # JS bundles and viewer source
html_dir = get_html_dir()  # HTML viewer templates
utils_dir = get_utils_dir() # Shared JS utilities
```

## Contents

- **JS Bundles**: VTK.js, Gaussian splatting, modular viewer bundle
- **Viewer Modules**: Modular viewer architecture (core, loaders, viewers, ui, features, utils)
- **Shared Utilities**: Extension folder detection, screenshot handling, UI components, formatting, analysis panels, postMessage helpers
- **HTML Templates**: Viewer pages for VTK, textured, dual, gaussian, UV, etc.

## Building

To rebuild the VTK.js bundle:

```bash
cd build_vtk_bundle
npm install
npm run build
```

## License

GPL-3.0-or-later
