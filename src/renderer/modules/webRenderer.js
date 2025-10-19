/**
 * Converts a JSON definition into an HTML element
 * @param {Object} node - JSON object describing HTML structure
 * @returns {HTMLElement}
 */
export function renderJSONToHTML(node) {
    if (typeof node === "string") {
        return document.createTextNode(node);
    }

    const el = document.createElement(node.tag);

    if (node.attrs) {
        for (const [key, value] of Object.entries(node.attrs)) {
            el.setAttribute(key, value);
        }
    }

    if (node.children) {
        for (const child of node.children) {
            el.appendChild(renderJSONToHTML(child));
        }
    }

    return el;
}

/**
* Replaces all content in the scene draw container with new HTML elements
* @param {Object} node - JSON object describing HTML structure
*/
export function changeSceneHTML(name, node) {
    const sceneDrawElement = document.querySelector('#sceneDraw');
    if (!sceneDrawElement) {
        console.error('Scene draw container not found');
        return;
    }

    // Clear existing content
    sceneDrawElement.innerHTML = '';

    // Render and append new content
    const newContent = renderJSONToHTML(node);
    sceneDrawElement.appendChild(newContent);
    document.querySelector('#Game').setAttribute('scene', name || 'none')
}
