/**
 * @fileoverview Utility functions for DOM manipulation, drag/drop interactions,
 * molecule parsing, and general helper methods.
 *
 * Includes:
 * - DOM utilities (show/hide elements, draggable support)
 * - Event handlers (pair selection, clickout)
 * - Molecular data processing (Molblock parsing, bond analysis)
 * - General helpers (percentage calculations, fetch data)
 *
 * @author Anh Vu
 * @version 1.0.0
 * @date 2026-03-03
 */


/**
 * Toggles visibility of a target element and optionally updates a button's label.
 *
 * @param {string} buttonSelector - CSS selector for the button to update.
 * @param {string} elementSelector - CSS selector for the element to show/hide.
 * @param {boolean} [buttonTextInstruction=false] - If true, changes button text.
 * @param {string} [elementName=""] - Name to display in the button label.
 */
function displayOrHideElement(buttonSelector, elementSelector, buttonTextInstruction = false, elementName = "") {
    const button = document.querySelector(buttonSelector);
    const element = document.querySelector(elementSelector);

    if (!button) {
        console.error(`Button with selector "${buttonSelector}" not found.`);
        return;
    }
    if (!element) {
        console.error(`Element with selector "${elementSelector}" not found.`);
        return;
    }

    const isVisible = window.getComputedStyle(element).display === "block";

    element.style.display = isVisible ? "none" : "block";

    if (buttonTextInstruction) {
        button.innerText = (isVisible ? "Open " : "Close ") + elementName;
    } else {
        console.error("One of two arguements buttonTextInstruction or elementName is missing while the other is present")
    }
}


/**
 * Fetches the content of a file from a specified URL and returns it as a plain text string.
 * 
 * Performs an HTTP GET request to the provided path. Throws an error if the request fails.
 * This function is asynchronous and should be used with `await` or `.then()`.
 * 
 * @async
 * @param {string} [path=""] - The URL or path to the file to fetch.
 * @returns {Promise<string>} - The content of the file as a plain text string.
 * 
 * @throws {Error} - If the fetch request fails or returns a non-OK status.
 */
async function getData(path = "") {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - Could not load file from URL: ${path}.`);
    }

    const contentString = await response.text();
    
    return contentString;
}

/**
 * Fetches and parses a JSON file from a given path.
 * 
 * @param {string} jsonPath - Path or URL to the JSON file.
 * @returns {Promise<Object>} Parsed JSON object.
 * @throws {Error} If the fetch fails or the file contains invalid JSON.
 */
async function getDataJSON(jsonPath) {
    const response = await getData(jsonPath);
    try {
        return JSON.parse(response);
    } catch (err) {
        console.error(`Invalid JSON at ${jsonPath}:`, err);
        throw new Error(`Failed to parse JSON from ${jsonPath}`);
    }
}

/**
 * Gets a DOM element and its parent element.
 * 
 * @param {string} divSelector - CSS selector for the child element.
 * @returns {{element: HTMLElement, parent: HTMLElement} | null} -  An object containing the selected element and its parent, or null if not found.
 */
function getDivAndParentEl(divSelector) {
    let div = document.querySelector(divSelector);

    if (!div) {
        console.error(`Element with selector "${divSelector}" not found.`);
        return null;
    }

    let parent = div.parentNode;
    
    if (!parent) {
        console.error(`Element with selector "${divSelector}" has no parent.`);
        return null;
    }

    return {
        element: div,
        parent: parent

    };
}

/**
 * Calculates a dimension (width or height) as a percentage of a parent element's size.
 * 
 * @param {string} divSelector - CSS selector for the child element.
 * @param {number} percentage - Percentage (0-100) to calculate.
 * @param {"width"|"height"} dimension - The dimension to use ("width" or "height").
 * @returns {number} - The calculated size in pixels.
 */
function percentage(divSelector, percentage, dimension) {
    let divAndParent = getDivAndParentEl(divSelector)

    if (!divAndParent) {
        return
    }

    let parent = divAndParent.parent;

    parentDimension = (dimension === "width") ? parent.offsetWidth : parent.offsetHeight 
    caculatedDimension = parentDimension * percentage / 100;

    return caculatedDimension
}

/**
 * Converts a string into an array of arrays by splitting lines and whitespace.
 * 
 * @param {string} file - The input string (e.g., a text file's contents).
 * @returns {string[][]} - A nested array of strings.
 */
function toArrayOfArrays(file) {
    return file
        .split("\n")                   
        .map(line => line.trim())      
        .filter(line => line.length)  
        .map(line => line.split(/\s+/)); 
}

