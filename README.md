# AI Book Tools


Static HTML/JavaScript tools for AI-assisted writing and book editing.

## Overview

This repository contains several browser-based tools:

- `index.html` — launcher page for the writing tools
- `NovelWriter/NovelWriter.html` — novel creation and chapter editing tool
- `BookEditor/BookEditor.html` — book editor interface
- `BookDecomposer/BookDecomposer.html` — book decomposition tool
- `HerbalBookForge/HerbalBookForge.html` — herbal book generator
- `user_guide.html` — help and usage instructions for Novel Writer

## Git Repository Setup

1. Install Git if it is not already installed.
2. Open a terminal in this folder: `c:\NovelWriterSite`
3. Run:
   ```powershell
   git init
git add .
git commit -m "Initial commit"
   ```

## API Key Guidance

These tools authenticate using API keys entered in the browser UI.

- Do not store API keys in source files.
- Do not commit API key files such as `.env`, `*.key`, or `*.secret`.
- Use the input fields in the app to provide the key at runtime.

## Running Locally

Open `index.html` in a browser and launch the tool you want to use.

## Notes

- This is a static web project; no build step is required.
- The `.gitignore` file is configured to keep local secrets and temporary files out of version control.

## Publishing to GitHub

If you have created a repository named `AI Book Tools` under `bnorth12`, add the remote and push from this folder:

```powershell
git remote add origin https://github.com/bnorth12/AI-Book-Tools.git
# Use main if you want the default GitHub branch name
git branch -M main
git push -u origin main
```

If you want to keep `master` instead of renaming:

```powershell
git push -u origin master
```
