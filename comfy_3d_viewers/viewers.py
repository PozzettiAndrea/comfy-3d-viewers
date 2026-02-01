"""Viewer file mappings for copy_viewer().

Each entry maps a viewer name to its files:
  html:    (filename, subdir) - HTML template
  widget:  (filename, subdir) - ComfyUI node widget JS
  bundle:  (filename, subdir) - single JS bundle dependency
  bundles: [(filename, subdir), ...] - multiple JS bundle dependencies
  utils:   True - copy shared JS utilities
"""

VIEWER_FILES = {
    # --- Three.js viewers ---
    "viewer": {
        "html": ("viewer.html", ""),
        "widget": ("mesh_preview.js", "js/"),
    },
    "fbx": {
        "html": ("viewer_fbx.html", ""),
        "bundle": ("viewer-bundle-three.js", "js/"),
        "widget": ("mesh_preview_fbx.js", "js/"),
    },
    "fbx_debug": {
        "html": ("viewer_fbx_debug.html", ""),
        "widget": ("debug_skeleton_widget.js", "js/"),
    },
    "fbx_compare": {
        "html": ("viewer_fbx_compare.html", ""),
        "widget": ("compare_skeleton_widget.js", "js/"),
    },
    "pbr": {
        "html": ("viewer_pbr.html", ""),
    },
    "uv": {
        "html": ("viewer_uv.html", ""),
        "widget": ("mesh_preview_uv.js", "js/"),
    },

    # --- VTK viewers ---
    "vtk": {
        "html": ("viewer_vtk.html", ""),
        "bundles": [("vtk-gltf.js", "js/"), ("viewer-bundle-vtk.js", "js/")],
        "widget": ("mesh_preview_vtk.js", "js/"),
        "utils": True,
        "viewer_modules": True,
    },
    "vtk_textured": {
        "html": ("viewer_vtk_textured.html", ""),
        "bundles": [("vtk-gltf.js", "js/"), ("viewer-bundle-vtk.js", "js/")],
        "widget": ("mesh_preview_vtk_textured.js", "js/"),
        "utils": True,
        "viewer_modules": True,
    },
    "pointcloud_vtk": {
        "html": ("viewer_vtk.html", ""),
        "bundles": [("vtk-gltf.js", "js/"), ("viewer-bundle-vtk.js", "js/")],
        "widget": ("pointcloud_preview_vtk.js", "js/"),
        "utils": True,
        "viewer_modules": True,
    },
    "multi": {
        "html": ("viewer_multi.html", ""),
        "bundle": ("vtk-gltf.js", "js/"),
        "widget": ("mesh_preview_multi.js", "js/"),
        "utils": True,
    },
    "dual": {
        "html": ("viewer_dual.html", ""),
        "bundle": ("vtk-gltf.js", "js/"),
        "widget": ("mesh_preview_dual.js", "js/"),
        "utils": True,
    },
    "dual_slider": {
        "html": ("viewer_dual_slider.html", ""),
        "bundles": [("vtk-gltf.js", "js/"), ("viewer-bundle-vtk.js", "js/")],
        "utils": True,
    },
    "dual_textured": {
        "html": ("viewer_dual_textured.html", ""),
        "bundle": ("vtk-gltf.js", "js/"),
        "utils": True,
    },

    # --- Gaussian splatting ---
    "gaussian": {
        "html": ("viewer_gaussian.html", ""),
        "bundle": ("gsplat-bundle.js", "js/"),
        "widget": ("gaussian_preview.js", "js/"),
    },

    # --- Motion capture viewers ---
    "bvh": {
        "html": ("viewer_bvh.html", ""),
        "widget": ("bvh_viewer.js", "js/"),
    },
    "fbx_animation": {
        "html": ("viewer_fbx_animation.html", ""),
        "widget": ("fbx_animation_viewer.js", "js/"),
    },
    "compare_smpl_bvh": {
        "html": ("viewer_compare_smpl_bvh.html", ""),
        "widget": ("compare_smpl_bvh.js", "js/"),
    },
    "smpl": {
        "widget": ("smpl_viewer.js", "js/"),
    },
    "smpl_camera": {
        "html": ("viewer_smpl_camera.html", ""),
        "widget": ("smpl_camera_viewer.js", "js/"),
    },
    "mhr": {
        "widget": ("mhr_viewer.js", "js/"),
    },

    # --- Node info widgets (no HTML viewer) ---
    "text_report": {
        "widget": ("text_report.js", "js/"),
    },

    # --- CAD viewers ---
    "cad_analysis": {
        "html": ("viewer_cad_analysis.html", ""),
        "bundle": ("vtk-gltf.js", "js/"),
        "widget": ("cad_analysis_viewer.js", "js/"),
        "utils": True,
    },
    "cad_curve": {
        "html": ("viewer_cad_curve.html", ""),
        "widget": ("cad_curve_plotter.js", "js/"),
    },
    "cad_edge": {
        "html": ("viewer_cad_edge.html", ""),
        "widget": ("cad_edge_viewer.js", "js/"),
    },
    "cad_edge_detail": {
        "html": ("viewer_cad_edge_detail.html", ""),
        "widget": ("cad_edge_detail_viewer.js", "js/"),
    },
    "cad_edge_vtk": {
        "html": ("viewer_cad_edge_vtk.html", ""),
        "bundle": ("vtk-gltf.js", "js/"),
        "widget": ("cad_edge_viewer_vtk.js", "js/"),
        "utils": True,
    },
    "cad_hierarchy": {
        "html": ("viewer_cad_hierarchy.html", ""),
        "widget": ("cad_hierarchy_viewer.js", "js/"),
    },
    "cad_occ": {
        "html": ("viewer_cad_occ.html", ""),
        "widget": ("cad_preview_occ.js", "js/"),
    },
    "cad_roi": {
        "html": ("viewer_cad_roi.html", ""),
        "widget": ("cad_roi_selector.js", "js/"),
    },
    "cad_spline": {
        "html": ("viewer_cad_spline.html", ""),
        "widget": ("cad_spline_viewer.js", "js/"),
    },
}
