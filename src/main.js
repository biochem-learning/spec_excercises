const MOL_CANVAS_WIDTH = 100; ///Change this to percentage(100) for cleaner code
const MOL_CANVAS_HEIGHT = 100; ///Change this to percentage(100) for cleaner code
const SPEC_CANVAS_WIDTH = 100; ///Change this to percentage(100) for cleaner code
const SPEC_CANVAS_HEIGHT = 100; ///Change this to percentage(100) for cleaner code
const USER_CANVAS_WIDTH = 100; ///Change this to percentage(100) for cleaner code
const USER_CANVAS_HEIGHT = 100; ///Change this to percentage(100) for cleaner code

const MOL_CANVAS_ID = "sample_molecule";
const SPEC_CANVAS_ID = "sample_spectrum";

const HINT_TEXTBOX =  document.querySelector("#hint-content"); 

let displayingMol = "problem1"
let viewingMode = "MS"

let spectraCache = {};
let hints = null;

/// Problem: Extreme Inefficient (The App fetch JSON every mousemove)

let canvases = setUpCanvas(
    'data/spectra/' + viewingMode + '/' + displayingMol + viewingMode + '.jdx',
    MOL_CANVAS_ID,
    SPEC_CANVAS_ID,
    MOL_CANVAS_WIDTH,
    MOL_CANVAS_HEIGHT,
    SPEC_CANVAS_WIDTH,
    SPEC_CANVAS_HEIGHT,
);

console.log(canvases)

let drawing_canvas;

createCompoundSubmenu("data/spectra/compound-menu.txt")

///////////////////////
/// WINDOW BEHAVIORS///
///////////////////////

document.querySelectorAll(".nav-bar-section").forEach(button => {
    button.addEventListener("click", function() {
        if (this.id === "dropdown-navbar") return;

        canvases = setUpCanvas('data/spectra/' + this.id + '/' + displayingMol + this.id + '.jdx',
            MOL_CANVAS_ID,
            SPEC_CANVAS_ID,
            MOL_CANVAS_WIDTH,
            MOL_CANVAS_HEIGHT,
            SPEC_CANVAS_WIDTH,
            SPEC_CANVAS_HEIGHT,
        ) 
        viewingMode = this.id;
    });
})


const fragmentTableButton = document.querySelector(".frag-table-button");
fragmentTableButton.addEventListener("click", () => {
    const open = fragmentTableButton.getAttribute("aria-expanded") !== "true";
    document.querySelector(".frag-table").style.display = open ? "block" : "none";
    fragmentTableButton.setAttribute("aria-expanded", String(open));
    fragmentTableButton.textContent = (open ? "Close" : "Open") + " Fragment Table";
});


const fragmentTable = document.querySelector(".frag-table");
const fragmentHeading = fragmentTable.querySelector(".f-t-general-instr");
fragmentHeading.title = "Drag to move the fragment table";
let tableDrag = null;
function placeFragmentTable(left, top) {
    const rect = fragmentTable.getBoundingClientRect();
    fragmentTable.style.left = Math.max(0, Math.min(left, window.innerWidth - rect.width)) + "px";
    fragmentTable.style.top = Math.max(0, Math.min(top, window.innerHeight - rect.height)) + "px";
}
fragmentHeading.addEventListener("pointerdown", event => {
    if (event.button !== 0 || tableDrag) return;
    event.preventDefault();
    const rect = fragmentTable.getBoundingClientRect();
    fragmentTable.style.position = "fixed";
    fragmentTable.style.boxSizing = "border-box";
    fragmentTable.style.width = rect.width + "px";
    fragmentTable.style.maxWidth = "calc(100vw - 16px)";
    fragmentTable.style.maxHeight = "calc(100dvh - 16px)";
    fragmentTable.style.right = "auto";
    placeFragmentTable(rect.left, rect.top);
    tableDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    fragmentHeading.setPointerCapture(event.pointerId);
    fragmentHeading.classList.add("dragging");
});
fragmentHeading.addEventListener("pointermove", event => {
    if (!tableDrag || tableDrag.id !== event.pointerId) return;
    const rect = fragmentTable.getBoundingClientRect();
    placeFragmentTable(rect.left + event.clientX - tableDrag.x, rect.top + event.clientY - tableDrag.y);
    tableDrag.x = event.clientX;
    tableDrag.y = event.clientY;
});
function stopTableDrag(event) {
    if (!tableDrag || tableDrag.id !== event.pointerId) return;
    tableDrag = null;
    fragmentHeading.classList.remove("dragging");
    if (fragmentHeading.hasPointerCapture(event.pointerId)) fragmentHeading.releasePointerCapture(event.pointerId);
}
fragmentHeading.addEventListener("pointerup", stopTableDrag);
fragmentHeading.addEventListener("pointercancel", stopTableDrag);
fragmentHeading.addEventListener("lostpointercapture", stopTableDrag);
window.addEventListener("resize", () => {
    if (fragmentTable.style.position === "fixed" && fragmentTable.style.display !== "none") {
        const rect = fragmentTable.getBoundingClientRect();
        placeFragmentTable(rect.left, rect.top);
    }
});

let RDKitLoader;
function loadRDKit() {
    if (!RDKitLoader) {
        RDKitLoader = window.initRDKitModule().catch(error => {
            RDKitLoader = null;
            throw error;
        });
    }
    return RDKitLoader;
}

const FRAGMENT_TEMPLATES = [
    { name: "Carbon", smiles: "*C(*)(*)*" },
    { name: "Oxygen", smiles: "*O*" },
    { name: "Hydrogen", smiles: "[H]*" },
    { name: "Chlorine", smiles: "Cl*" },
    { name: "Bromine", smiles: "Br*" },
    { name: "Carbonyl", smiles: "*C(*)=O" },
    { name: "Nitrogen", smiles: "*N(*)*" },
    { name: "Alkene", smiles: "*C(*)=C(*)*" },
    { name: "Benzene", smiles: "*C1=C(*)C(*)=C(*)C(*)=C1*" }
];

async function createFragmentWorkspace() {
    const host = document.querySelector("#frag-canvas");
    const element = document.querySelector("#draw-canvas");
    const status = document.querySelector("#fragment-status");
    const deleteButton = document.querySelector("#del-frag-button");
    const undoButton = document.querySelector("#undo-frag-button");
    const clearButton = document.querySelector("#clear-frag-button");
    const table = document.querySelector(".frag-table");
    const hint = "Drag a structure to move it. Click two blue ends to connect them.";
    const editor = new ChemDoodle.SketcherCanvas(element.id, Math.max(200, host.clientWidth), 240, {
        includeToolbar: false, useServices: false, oneMolecule: false,
        requireStartingAtom: false, resizable: false
    });
    drawing_canvas = {
        getMolecule() {
            const graph = buildGraph();
            const openEnds = new Set(graph.atoms.filter(atom => atom.portKey));
            graph.atoms = graph.atoms.filter(atom => !openEnds.has(atom));
            graph.bonds = graph.bonds.filter(bond => !openEnds.has(bond.a1) && !openEnds.has(bond.a2));
            return graph;
        }
    };
    editor.hideHelp = true;
    editor.styles.backgroundColor = "aliceblue";
    editor.styles.atoms_displayTerminalCarbonLabels_2D = false;
    editor.styles.bondLength_2D = 28;
    for (const event of ["click", "dblclick", "mousedown", "mousemove", "mouseup",
        "mouseover", "mouseout", "rightclick", "rightmousedown", "rightmouseup",
        "drag", "mousewheel", "keydown", "keypress", "keyup", "touchstart",
        "touchmove", "touchend", "gesturechange", "gestureend"]) {
        editor[event] = () => {};
    }
    let fragments = [], connections = [], history = [], selected = null;
    let pendingPort = null, gesture = null, nextId = 1, deleteMode = false;
    let renderedAtoms = [];
    const snapshot = () => JSON.stringify({ fragments, connections, nextId });
    function remember(before = snapshot()) {
        history.push(before);
        if (history.length > 100) history.shift();
    }
    function announce(message = hint) { status.textContent = message; }
    function buildGraph() {
        const graph = new ChemDoodle.structures.Molecule();
        const atoms = new Map();
        const used = new Set(connections.flatMap(link => [link.a, link.b]));
        for (const fragment of fragments) {
            fragment.atoms.forEach((data, index) => {
                const key = fragment.id + ":" + index;
                if (used.has(key)) return;
                const atom = new ChemDoodle.structures.Atom(data.label, data.x, data.y);
                atom.fragmentId = fragment.id;
                atom.portKey = data.label === "*" ? key : null;
                atoms.set(key, atom);
                graph.atoms.push(atom);
            });
            for (const bond of fragment.bonds) {
                const a = atoms.get(fragment.id + ":" + bond.a);
                const b = atoms.get(fragment.id + ":" + bond.b);
                if (a && b) graph.bonds.push(new ChemDoodle.structures.Bond(a, b, bond.order));
            }
        }
        function anchor(key) {
            const [id, index] = key.split(":").map(Number);
            const fragment = fragments.find(item => item.id === id);
            const bond = fragment.bonds.find(item => item.a === index || item.b === index);
            return atoms.get(id + ":" + (bond.a === index ? bond.b : bond.a));
        }
        for (const link of connections) {
            graph.bonds.push(new ChemDoodle.structures.Bond(anchor(link.a), anchor(link.b), 1));
        }
        return graph;
    }
    function render() {
        const graph = buildGraph();
        renderedAtoms = graph.atoms;
        editor.molecules = new ChemDoodle.informatics.Splitter().split(graph);
        editor.molecules.forEach(molecule => molecule.check());
        editor.repaint();
        undoButton.disabled = history.length === 0;
        clearButton.disabled = fragments.length === 0;
        deleteButton.disabled = fragments.length === 0;
        deleteButton.setAttribute("aria-pressed", String(deleteMode));
    }
    const originalExtras = editor.drawChildExtras;
    editor.drawChildExtras = function(ctx, styles) {
        originalExtras.call(this, ctx, styles);
        for (const atom of renderedAtoms) {
            if (!atom.portKey && atom.fragmentId !== selected) continue;
            ctx.beginPath();
            ctx.arc(atom.x, atom.y, atom.portKey ? 7 : 5, 0, Math.PI * 2);
            ctx.strokeStyle = atom.portKey === pendingPort ? "#dc7800" : atom.portKey ? "#2563eb" : "#7d8b9d";
            ctx.lineWidth = atom.portKey === pendingPort ? 3 : 1.5;
            ctx.stroke();
        }
        if (gesture && gesture.port && gesture.point) {
            const start = renderedAtoms.find(atom => atom.portKey === gesture.port);
            if (start) {
                ctx.beginPath();
                ctx.setLineDash([4, 4]);
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(gesture.point.x, gesture.point.y);
                ctx.strokeStyle = "#2563eb";
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    };
    function connectedIds(id) {
        const ids = new Set([id]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const link of connections) {
                const a = Number(link.a.split(":")[0]), b = Number(link.b.split(":")[0]);
                if (ids.has(a) !== ids.has(b)) { ids.add(a); ids.add(b); changed = true; }
            }
        }
        return ids;
    }
    function removeFragment(id) {
        remember();
        fragments = fragments.filter(fragment => fragment.id !== id);
        connections = connections.filter(link => ![link.a, link.b].some(key => key.startsWith(id + ":")));
        selected = pendingPort = null;
        if (!fragments.length) deleteMode = false;
        render();
        announce("Fragment deleted. Undo restores it and its connections.");
    }
    const RDKit = await loadRDKit();
    function connect(a, b) {
        if (a === b) { pendingPort = null; render(); return; }
        const before = snapshot();
        const [aId, aIndex] = a.split(":").map(Number);
        const [bId, bIndex] = b.split(":").map(Number);
        const first = fragments.find(fragment => fragment.id === aId);
        const second = fragments.find(fragment => fragment.id === bId);
        function portAnchor(fragment, index) {
            const bond = fragment.bonds.find(item => item.a === index || item.b === index);
            return fragment.atoms[bond.a === index ? bond.b : bond.a];
        }
        if (!connectedIds(aId).has(bId)) {
            const anchorA = portAnchor(first, aIndex), anchorB = portAnchor(second, bIndex);
            const portA = first.atoms[aIndex], portB = second.atoms[bIndex];
            const angleA = Math.atan2(portA.y-anchorA.y, portA.x-anchorA.x);
            const angleB = Math.atan2(portB.y-anchorB.y, portB.x-anchorB.x);
            const rotation = angleA + Math.PI - angleB;
            const origin = { x: anchorB.x, y: anchorB.y };
            const target = { x: anchorA.x + 28*Math.cos(angleA), y: anchorA.y + 28*Math.sin(angleA) };
            const moving = connectedIds(bId);
            for (const fragment of fragments) if (moving.has(fragment.id)) {
                for (const atom of fragment.atoms) {
                    const x = atom.x-origin.x, y = atom.y-origin.y;
                    atom.x = target.x + x*Math.cos(rotation) - y*Math.sin(rotation);
                    atom.y = target.y + x*Math.sin(rotation) + y*Math.cos(rotation);
                }
            }
        }
        connections.push({ a, b });
        let molecule;
        try {
            const graph = buildGraph();
            if (graph.bonds.some(bond => bond.a1 === bond.a2)) throw new Error("Choose ends on different atoms.");
            const pairs = new Set();
            for (const bond of graph.bonds) {
                const key = [graph.atoms.indexOf(bond.a1), graph.atoms.indexOf(bond.a2)].sort((x,y) => x-y).join(":");
                if (pairs.has(key)) throw new Error("Those atoms are already connected.");
                pairs.add(key);
            }
            molecule = RDKit.get_mol(ChemDoodle.writeMOL(graph), JSON.stringify({ removeHs: false }));
            if (!molecule || !molecule.is_valid()) throw new Error("These ends cannot form a valid bond.");
            remember(before);
            announce("Connected. Remaining blue ends can accept more fragments.");
        } catch (error) {
            const previous = JSON.parse(before);
            fragments = previous.fragments;
            connections = previous.connections;
            announce(error.message || "Could not connect these fragments.");
        } finally {
            molecule?.delete();
            pendingPort = null;
            render();
        }
    }
    function point(event) {
        const rect = element.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * editor.width / rect.width,
            y: (event.clientY - rect.top) * editor.height / rect.height };
    }
    function hit(p) {
        let closest = null, distance = 15;
        for (const atom of renderedAtoms) {
            const d = Math.hypot(atom.x - p.x, atom.y - p.y);
            if (d < distance) { closest = atom; distance = d; }
        }
        if (closest) return closest;
        for (const molecule of editor.molecules) {
            for (const bond of molecule.bonds) {
                const dx = bond.a2.x - bond.a1.x, dy = bond.a2.y - bond.a1.y;
                const t = Math.max(0, Math.min(1, ((p.x-bond.a1.x)*dx+(p.y-bond.a1.y)*dy)/(dx*dx+dy*dy || 1)));
                if (Math.hypot(p.x-bond.a1.x-t*dx, p.y-bond.a1.y-t*dy) < 8) {
                    return { fragmentId: bond.a1.fragmentId, portKey: null };
                }
            }
        }
        return null;
    }
    element.addEventListener("pointerdown", event => {
        if (event.button !== 0 || gesture) return;
        event.preventDefault();
        element.focus();
        const p = point(event), target = hit(p);
        if (!target) { selected = pendingPort = null; render(); return; }
        if (deleteMode) { removeFragment(target.fragmentId); return; }
        selected = target.fragmentId;
        gesture = { pointerId: event.pointerId, start: p, last: p, point: p,
            port: target.portKey, ids: connectedIds(selected), before: snapshot(), moved: false };
        element.setPointerCapture(event.pointerId);
        render();
    });
    element.addEventListener("pointermove", event => {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        const p = point(event);
        if (Math.hypot(p.x-gesture.start.x, p.y-gesture.start.y) > 4) gesture.moved = true;
        if (gesture.moved && !gesture.port) {
            for (const fragment of fragments) if (gesture.ids.has(fragment.id)) {
                for (const atom of fragment.atoms) { atom.x += p.x-gesture.last.x; atom.y += p.y-gesture.last.y; }
            }
        }
        gesture.last = gesture.point = p;
        render();
    });
    function release(event, cancelled = false) {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        const current = gesture;
        gesture = null;
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        if (cancelled) {
            const previous = JSON.parse(current.before);
            fragments = previous.fragments; connections = previous.connections;
            pendingPort = null;
        } else if (current.port) {
            const target = hit(point(event));
            if (current.moved) {
                if (target?.portKey && target.portKey !== current.port) connect(current.port, target.portKey);
                else announce("Drop on another blue end to connect.");
            } else if (pendingPort) connect(pendingPort, current.port);
            else { pendingPort = current.port; announce("Now click another blue end. Escape cancels."); }
        } else if (current.moved) { remember(current.before); pendingPort = null; }
        render();
    }
    element.addEventListener("pointerup", event => release(event));
    element.addEventListener("pointercancel", event => release(event, true));
    function undo() {
        if (!history.length || gesture) return;
        const previous = JSON.parse(history.pop());
        fragments = previous.fragments; connections = previous.connections; nextId = previous.nextId;
        selected = pendingPort = null; deleteMode = false;
        render(); announce("Undone.");
    }
    deleteButton.addEventListener("click", () => {
        if (selected !== null) { removeFragment(selected); return; }
        deleteMode = !deleteMode; pendingPort = null;
        render(); announce(deleteMode ? "Click a fragment to delete it." : hint);
    });
    undoButton.addEventListener("click", undo);
    clearButton.addEventListener("click", () => {
        if (!fragments.length) return;
        remember(); fragments = []; connections = [];
        selected = pendingPort = null; deleteMode = false;
        render(); announce("Canvas cleared. Undo restores your work.");
    });
    element.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault(); undo();
        } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            if (selected !== null) removeFragment(selected);
        } else if (event.key === "Escape") {
            pendingPort = selected = null; deleteMode = false; render(); announce();
        }
        event.stopPropagation();
    });
    const templates = await Promise.all(FRAGMENT_TEMPLATES.map(async (definition, index) => {
        const svgText = await getData("data/frag-library/frag" + index + ".svg");
        const svg = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
        if (svg.localName !== "svg") throw new Error("Invalid fragment SVG.");
        let molecule;
        try {
            molecule = RDKit.get_mol(definition.smiles, JSON.stringify({ removeHs: false }));
            if (!molecule) throw new Error("Invalid fragment structure.");
            const model = ChemDoodle.readMOL(molecule.get_molblock());
            model.atoms.forEach(atom => { if (atom.label === "R") atom.label = "*"; });
            model.scaleToAverageBondLength(28);
            return { svg, model, name: definition.name };
        } finally { molecule?.delete(); }
    }));
    for (const { svg, model, name } of templates) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fragment-choice";
        button.title = "Add " + name.toLowerCase() + " fragment";
        button.setAttribute("aria-label", button.title);
        button.appendChild(document.importNode(svg, true));
        button.addEventListener("click", () => {
            remember();
            const center = model.getCenter();
            const slot = fragments.length % 6;
            const x = editor.width * (0.28 + (slot % 2) * 0.44);
            const y = 60 + Math.floor(slot / 2) * Math.max(20, (editor.height - 120) / 2);
            fragments.push({ id: nextId++, atoms: model.atoms.map(atom => ({
                label: atom.label, x: atom.x-center.x+x, y: atom.y-center.y+y
            })), bonds: model.bonds.map(bond => ({
                a: model.atoms.indexOf(bond.a1), b: model.atoms.indexOf(bond.a2), order: bond.bondOrder
            })) });
            selected = nextId-1; pendingPort = null; deleteMode = false;
            render(); announce(); element.focus();
        });
        table.appendChild(button);
    }
    function resize() {
        const width = Math.max(100, host.clientWidth);
        const section = host.closest("#draw-section");
        const height = Math.max(160, section.clientHeight -
            section.querySelector(".u-s-header").offsetHeight -
            section.querySelector(".fragment-controls").offsetHeight - status.offsetHeight - 12);
        if (width !== editor.width || height !== editor.height) editor.resize(width, height);
        render();
    }
    new ResizeObserver(resize).observe(host);
    new ResizeObserver(resize).observe(host.closest("#draw-section"));
    resize(); announce();
}

createFragmentWorkspace().catch(error => {
    console.error("Fragment workspace failed to load:", error);
    document.querySelector("#fragment-status").textContent =
        "Could not load the fragment editor. Reload the page to try again.";
});

async function setUpCanvas(path='', molCanvasId, specCanvasId, molWidthPercent, molHeightPercent, specWidthPercent, specHeightPercent) {
    removeCanvas(molCanvasId)
    removeCanvas(specCanvasId)

    let data = await getData(path) 

    let canvas = new ChemDoodle.io.JCAMPInterpreter().makeStructureSpectrumSet(
        'sample', 
        data, 
        percentage("#" + molCanvasId, molWidthPercent, "width"), 
        percentage("#" + molCanvasId, molHeightPercent, "height"), 
        percentage("#" + specCanvasId, specWidthPercent, "width"), 
        percentage("#" + specCanvasId, specHeightPercent, "height"),
    )

    canvas[1].spectrum.title = " "

    console.log(canvas[1].spectrum.title)
    canvas[1].repaint()

    console.log(canvas);
    return canvas;
}

let resizeTimeout;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(async () => {
        canvases = await setUpCanvas(
            'data/spectra/' + viewingMode + '/' + displayingMol + viewingMode + '.jdx',
            MOL_CANVAS_ID,
            SPEC_CANVAS_ID,
            MOL_CANVAS_WIDTH,
            MOL_CANVAS_HEIGHT,
            SPEC_CANVAS_WIDTH,
            SPEC_CANVAS_HEIGHT
        );
    }, 30);
});

function removeCanvas(canvasId) {
	let canvasAndParent = getDivAndParentEl("#" + canvasId);

    if (!canvasAndParent) {
        return
    }

    let canvas = canvasAndParent.element;
    let parent = canvasAndParent.parent;
    let newCanvas = document.createElement("canvas");
    
    newCanvas.id = canvasId;

	parent.replaceChild(newCanvas, canvas);
}

async function createCompoundSubmenu(menuFilePath) {
    const dropdownMenu = document.querySelector("#dropdown-navbar");
    if (!dropdownMenu) {
        console.error("Dropdown container '#dropdown-navbar' not found.");
        return;
    }

    dropdownMenu.querySelector(".dropdown-content")?.remove();

    const ddContentWrapper = document.createElement("div");
    ddContentWrapper.classList.add("dropdown-content");
    dropdownMenu.appendChild(ddContentWrapper);

    try {
        const response = await fetch(menuFilePath);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const textData = await response.text();
        const itemArray = textData
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean); 

        itemArray.forEach((compoundName, index) => {
            const subItem = document.createElement("a");
            subItem.textContent = compoundName;
            subItem.id = `dropdown-item-${index}`;
            subItem.classList.add('dropdown-item');
            ddContentWrapper.appendChild(subItem);

            subItem.addEventListener('click', (event) => {
                event.preventDefault();

                console.log(`Selected compound: ${compoundName}`);
                displayingMol = compoundName;
                resetHints();
                viewingMode = "MS"

                canvases = setUpCanvas(
                    `data/spectra/MS/${compoundName}MS.jdx`,
                    MOL_CANVAS_ID,
                    SPEC_CANVAS_ID,
                    MOL_CANVAS_WIDTH,
                    MOL_CANVAS_HEIGHT,
                    SPEC_CANVAS_WIDTH,
                    SPEC_CANVAS_HEIGHT
                );
            });
        });
    } catch (error) {
        console.error("Error reading menu file:", error);
    }
}

async function getSpectraJSON(molecule) {
    if (spectraCache[molecule]) {
        return spectraCache[molecule];
    }
    const data = await getDataJSON(`data/spectra/spec-description/${molecule}.json`);
    spectraCache[molecule] = data;
    return data;
}

function getSpectraSection(dataJSON, mode) {
    if (!mode) return dataJSON.description;
    return dataJSON?.spectra_info?.[mode]?.general_description || "";
}

let hintNum = 0;
let hintRequest = 0;
const hintCache = new Map();
const hintButton = document.querySelector("#hint-btn");
const hintFiles = {
    problem1: "data/hints/Ethanol.json",
    problem2: "data/hints/2-Pentanone.json",
    problem3: "data/hints/3-Pentanone.json"
};

async function getHints(path) {
    if (!hintCache.has(path)) {
        hintCache.set(path, getDataJSON(path).then(data => {
            const levels = Array.isArray(data.hints) ? data.hints :
                Object.keys(data.hints || {}).sort((a, b) => Number(a) - Number(b)).map(key => data.hints[key]);
            if (levels.some(level => typeof level.general_description !== "string")) {
                throw new Error("Invalid hint data");
            }
            return levels;
        }).catch(error => { hintCache.delete(path); throw error; }));
    }
    return hintCache.get(path);
}

async function resetHints() {
    const request = ++hintRequest;
    hints = null;
    hintNum = 0;
    HINT_TEXTBOX.replaceChildren();
    HINT_TEXTBOX.scrollTop = 0;
    hintButton.disabled = true;
    hintButton.textContent = "Loading hints…";
    try {
        const path = hintFiles[displayingMol];
        const levels = path ? await getHints(path) : [];
        if (request !== hintRequest) return;
        hints = levels;
        hintButton.disabled = levels.length === 0;
        hintButton.textContent = levels.length ? "Hint" : "No hints available";
    } catch (error) {
        if (request !== hintRequest) return;
        HINT_TEXTBOX.textContent = "Hints could not be loaded. Click Retry hints to try again.";
        hintButton.textContent = "Retry hints";
        hintButton.disabled = false;
        console.error("Error loading hints:", error);
    }
}

function displayHint(levels, index, textBoxEl = HINT_TEXTBOX) {
    const level = levels[index];
    if (!level) return;
    const entry = document.createElement("section");
    entry.className = "hint-level";
    const title = document.createElement("strong");
    title.textContent = "Hint " + (index + 1);
    const text = document.createElement("p");
    text.textContent = level.general_description;
    entry.append(title, text);
    textBoxEl.appendChild(entry);
    textBoxEl.scrollTop = textBoxEl.scrollHeight;
}

hintButton.addEventListener("click", () => {
    if (hints === null) { resetHints(); return; }
    if (hintNum >= hints.length) return;
    displayHint(hints, hintNum++);
    hintButton.disabled = hintNum === hints.length;
    hintButton.textContent = hintNum === hints.length ? "All hints shown" : "Next hint";
});
HINT_TEXTBOX.setAttribute("role", "log");
HINT_TEXTBOX.setAttribute("aria-live", "polite");
HINT_TEXTBOX.setAttribute("aria-relevant", "additions");
resetHints();

/// Get a mol string from chemdoodle convert it into SMILES, compare it with each other, return true or false
async function compareMol(mol1, mol2) {
    let RDKit = await loadRDKit()
    let mol1Obj = RDKit.get_mol(mol1)
    let mol2Obj = RDKit.get_mol(mol2)

    const inchi1 = mol1Obj.get_inchi();
    const inchi2 = mol2Obj.get_inchi();

    console.log(inchi1)
    console.log(inchi2)

    return inchi1 === inchi2
}

async function getAnswer() {
    let arr = await canvases
    /// Get input from chemdoodle
    const input = drawing_canvas ? getMolBlockStr(drawing_canvas) : null;
    const mol = getMolBlockStr(arr[0]);
    /// Get mol from
    let correct = input ? await compareMol(input, mol) : false
    if (correct) {
        correctSound.play()
        getMolAlert(correctIcon, "Correct!");
        document.querySelector("#sample_molecule").style.display = "block"
    }
    else {
        wrongDupSound.play()
        getMolAlert(wrongIcon, "Incorrect!");
    }
    console.log(input)
    console.log(mol)
}

function getMolBlockStr(canvas) {
	const molecule = canvas.getMolecule();
    if (canvas === drawing_canvas && !molecule.atoms.length) return null;
    return ChemDoodle.writeMOL(molecule);
};

document.querySelector("#answ-btn").addEventListener("click", function() {
    getAnswer()
    // console.log(getMolBlockStr(drawing_canvas))
})

document.querySelector("#show-answer-btn").addEventListener("click", async function() {
    const currentCanvases = canvases;
    this.disabled = true;
    try {
        await currentCanvases;
        if (currentCanvases !== canvases) return;
        document.querySelector("#sample_molecule").style.display = "block";
    } catch (error) {
        console.error("Could not display the answer:", error);
    } finally {
        this.disabled = false;
    }
});

const correctSound = new Audio("bg-music/correctAns.mp3");
const wrongDupSound = new Audio("bg-music/wrongDupAns.mp3");

const wrongIcon = document.querySelector("#icon-wrong")
const correctIcon = document.querySelector("#icon-correct")
const checkMessageNode = document.querySelector(".alert");

function getMolAlert (iconNode, alertMessage) {
	iconNode.classList.add("active");
	checkMessageNode.innerText = alertMessage;
	checkMessageNode.classList.add("active");

	setTimeout(() => {
		iconNode.classList.remove("active");
		checkMessageNode.classList.remove("active");
	}, 1500);
};
