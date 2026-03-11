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

let drawing_canvas = new ChemDoodle.SketcherCanvas(
    'draw-canvas', 
    percentage("#draw-canvas", 100, "width"),
    percentage("#draw-canvas", 83, "height"),
    {useServices:true, 
    oneMolecule:true}
)

drawing_canvas.styles.atoms_displayTerminalCarbonLabels_2D = true;
drawing_canvas.styles.atoms_useJMOLColors = true;
drawing_canvas.styles.bonds_clearOverlaps_2D = true;
drawing_canvas.styles.shapes_color = "c10000";

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


// Wait for RDKit to finish loading
let RDKitLoader = null;

function loadRDKit() {
  if (!RDKitLoader) {
    RDKitLoader = window.initRDKitModule()
      .then((RDKit) => {
        console.log("RDKit version: " + RDKit.version());
        return RDKit;
      })
      .catch((err) => {
        console.error("Failed to load RDKit module.", err);
        throw err;
      });
  }
  return RDKitLoader;
}

async function useRDKit() {
    let RDKit = await loadRDKit();
    const mol = RDKit.get_mol("ClC");
    console.log(mol.get_smiles());
}

useRDKit();

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
async function getHints(path) {
    hints = await getDataJSON(path);
}

(async () => {
    await getHints("data/hints/2-Pentanone.json");
})();

console.log(hints);

function displayHint(hints, hintNum, textBoxEl = HINT_TEXTBOX) {

}

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
    const input = getMolBlockStr(drawing_canvas);
    const mol = getMolBlockStr(arr[0]);
    /// Get mol from
    let correct = await compareMol(input, mol)
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
	return ChemDoodle.writeMOL(canvas.getMolecule());
};

document.querySelector("#answ-btn").addEventListener("click", function() {
    getAnswer()
    // console.log(getMolBlockStr(drawing_canvas))
})

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
