# Spectroscopic Identifying Exercise App

> [!WARNING]
> Update ChemDoodle library is NOT recommended: The current library has been modified

A web-based interactive spectroscopy exercise for identifying organic compounds from MS, IR, HNMR, and C NMR data, with progressive hints, a fragment-based structure builder, and answer feedback.

![demo_1](public/demo/demo_1.png)

![demo_2](public/demo/demo_2.png)

![correct](public/demo/correct.png)

![incorrect](public/demo/incorrect.png)

## Local setup

### Requirements

- A modern web browser
- Python 3 or another local HTTP server

### Running the project

```bash
git clone https://github.com/biochem-learning/spec_excercises.git
cd spectrum-app-v2
python3 -m http.server 8000
```

On Windows, use:

```powershell
py -m http.server 8000
```

Open the applications in your browser: <http://localhost:8000>

## Acknoledgement

This project uses a modified version of [ChemDoodle Web Components](https://web.chemdoodle.com/) by iChemLabs, licensed under GPLv3.
