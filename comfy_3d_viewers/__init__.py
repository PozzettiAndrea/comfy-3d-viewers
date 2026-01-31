# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2025 comfy-3d-viewers Contributors

"""
comfy-3d-viewers: Reusable 3D viewer infrastructure for ComfyUI nodes.

Provides VTK.js, Three.js FBX, and Gaussian splatting viewers, shared utilities,
and HTML templates for 3D mesh visualization in ComfyUI.
"""

import os

__version__ = "0.2.0"


def get_package_dir() -> str:
    """Return the root directory of the comfy_3d_viewers package."""
    return os.path.dirname(os.path.abspath(__file__))


def get_web_dir() -> str:
    """Return path to the web directory containing JS and HTML files."""
    return os.path.join(get_package_dir(), "web")


def get_js_dir() -> str:
    """Return path to the JS directory containing viewer bundles."""
    return os.path.join(get_web_dir(), "js")


def get_html_dir() -> str:
    """Return path to the HTML viewer templates directory."""
    return os.path.join(get_web_dir(), "html")


def get_utils_dir() -> str:
    """Return path to the shared JS utilities directory."""
    return os.path.join(get_js_dir(), "utils")


def get_viewer_dir() -> str:
    """Return path to the modular viewer source directory."""
    return os.path.join(get_js_dir(), "viewer")


def get_nodes_dir() -> str:
    """Return path to the node widget JS files directory."""
    return os.path.join(get_js_dir(), "nodes")


def get_assets_dir() -> str:
    """Return path to the assets directory (HDR environments, etc.)."""
    return os.path.join(get_web_dir(), "assets")


def list_html_templates() -> list[str]:
    """List all available HTML viewer templates."""
    html_dir = get_html_dir()
    if not os.path.exists(html_dir):
        return []
    return [f for f in os.listdir(html_dir) if f.endswith('.html')]


def list_js_bundles() -> list[str]:
    """List all available JS bundle files."""
    js_dir = get_js_dir()
    if not os.path.exists(js_dir):
        return []
    return [f for f in os.listdir(js_dir) if f.endswith('.js') and not os.path.isdir(os.path.join(js_dir, f))]


def list_utils() -> list[str]:
    """List all available utility modules."""
    utils_dir = get_utils_dir()
    if not os.path.exists(utils_dir):
        return []
    return [f for f in os.listdir(utils_dir) if f.endswith('.js')]


# FBX Viewer specific functions

def get_three_dir() -> str:
    """Return path to the Three.js modules directory (for FBX viewer)."""
    return os.path.join(get_web_dir(), "three")


def get_fbx_html_path() -> str:
    """Return path to the FBX viewer HTML template."""
    return os.path.join(get_html_dir(), "viewer_fbx.html")


def get_fbx_bundle_path() -> str:
    """Return path to the Three.js bundle for FBX viewer."""
    return os.path.join(get_three_dir(), "viewer-bundle.js")


def get_fbx_node_widget_path() -> str:
    """Return path to the generic FBX preview node widget JS file."""
    return os.path.join(get_nodes_dir(), "mesh_preview_fbx.js")


def get_fbx_debug_html_path() -> str:
    """Return path to the FBX debug viewer HTML template."""
    return os.path.join(get_html_dir(), "viewer_fbx_debug.html")


def get_fbx_compare_html_path() -> str:
    """Return path to the FBX compare viewer HTML template."""
    return os.path.join(get_html_dir(), "viewer_fbx_compare.html")


def get_fbx_debug_widget_path() -> str:
    """Return path to the debug skeleton widget JS file."""
    return os.path.join(get_nodes_dir(), "debug_skeleton_widget.js")


def get_fbx_compare_widget_path() -> str:
    """Return path to the compare skeleton widget JS file."""
    return os.path.join(get_nodes_dir(), "compare_skeleton_widget.js")


# SMPL Viewer specific functions

def get_smpl_widget_path() -> str:
    """Return path to the SMPL viewer widget JS file (Canvas 2D, no HTML needed)."""
    return os.path.join(get_nodes_dir(), "smpl_viewer.js")


# Compare SMPL/BVH Viewer specific functions

def get_compare_smpl_bvh_html_path() -> str:
    """Return path to the Compare SMPL/BVH viewer HTML template."""
    return os.path.join(get_html_dir(), "viewer_compare_smpl_bvh.html")


def get_compare_smpl_bvh_widget_path() -> str:
    """Return path to the Compare SMPL/BVH widget JS file."""
    return os.path.join(get_nodes_dir(), "compare_smpl_bvh.js")


# BVH Viewer specific functions

def get_bvh_html_path() -> str:
    """Return path to the BVH viewer HTML template."""
    return os.path.join(get_html_dir(), "viewer_bvh.html")


def get_bvh_widget_path() -> str:
    """Return path to the BVH viewer widget JS file."""
    return os.path.join(get_nodes_dir(), "bvh_viewer.js")


# MHR Viewer specific functions

def get_mhr_widget_path() -> str:
    """Return path to the MHR skeleton viewer widget JS file (Canvas 2D, no HTML needed)."""
    return os.path.join(get_nodes_dir(), "mhr_viewer.js")


# FBX Animation Viewer specific functions

def get_fbx_animation_html_path() -> str:
    """Return path to the FBX animation viewer HTML template."""
    return os.path.join(get_html_dir(), "viewer_fbx_animation.html")


def get_fbx_animation_widget_path() -> str:
    """Return path to the FBX animation viewer widget JS file."""
    return os.path.join(get_nodes_dir(), "fbx_animation_viewer.js")


# Utility functions

def get_file_list_updater_path() -> str:
    """Return path to the file list updater utility JS file."""
    return os.path.join(get_nodes_dir(), "file_list_updater.js")


# High-level copy helpers

VIEWER_FILES = {
    "fbx": {
        "html": ("viewer_fbx.html", ""),
        "bundle": ("viewer-bundle.js", "three/"),
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
    "bvh": {
        "html": ("viewer_bvh.html", ""),
        "widget": ("bvh_viewer.js", "js/"),
    },
    "fbx_animation": {
        "html": ("viewer_fbx_animation.html", ""),
        "widget": ("fbx_animation_viewer.js", "js/"),
    },
}


def copy_viewer(viewer: str, target_dir) -> None:
    """Copy viewer files to target directory."""
    import shutil
    from pathlib import Path

    target_dir = Path(target_dir)
    files = VIEWER_FILES.get(viewer)
    if not files:
        raise ValueError(f"Unknown viewer: {viewer}")

    for file_type, (filename, subdir) in files.items():
        if file_type == "html":
            src = os.path.join(get_html_dir(), filename)
        elif file_type == "bundle":
            src = os.path.join(get_three_dir(), filename)
        elif file_type == "widget":
            src = os.path.join(get_nodes_dir(), filename)
        else:
            continue

        dst_dir = target_dir / subdir if subdir else target_dir
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / filename

        if os.path.exists(src) and (not dst.exists() or os.path.getmtime(src) > os.path.getmtime(dst)):
            shutil.copy2(src, dst)


def copy_files(src, dst, pattern: str = "*") -> None:
    """Copy files matching pattern from src to dst (skip existing)."""
    import shutil
    from pathlib import Path

    src, dst = Path(src), Path(dst)
    if not src.exists():
        return

    dst.mkdir(parents=True, exist_ok=True)
    for f in src.glob(pattern):
        if f.is_file():
            target = dst / f.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                shutil.copy2(f, target)
