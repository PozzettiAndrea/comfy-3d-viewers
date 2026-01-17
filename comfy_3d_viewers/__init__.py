# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2025 comfy-3d-viewers Contributors

"""
comfy-3d-viewers: Reusable 3D viewer infrastructure for ComfyUI nodes.

Provides VTK.js and Gaussian splatting viewers, shared utilities,
and HTML templates for 3D mesh visualization in ComfyUI.
"""

import os

__version__ = "0.1.0"


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
