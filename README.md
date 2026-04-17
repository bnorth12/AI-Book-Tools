# AI Book Tools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/bnorth12/AI-Book-Tools)](https://github.com/bnorth12/AI-Book-Tools/issues)
[![GitHub stars](https://img.shields.io/github/stars/bnorth12/AI-Book-Tools)](https://github.com/bnorth12/AI-Book-Tools/stargazers)

Static HTML/JavaScript tools for AI-assisted writing and book editing.

## Quick Start

1. **Download**: Clone or download this repository
2. **Open**: Launch `index.html` in your web browser
3. **Configure**: Enter your xAI API key in each tool
4. **Create**: Start writing with AI assistance!

## Project Structure

```
AI-Book-Tools/
├── index.html                 # Main launcher page
├── README.md                  # This file
├── CONTRIBUTING.md           # Contribution guidelines
├── CHANGELOG.md              # Version history
├── LICENSE                   # MIT License
├── package.json              # Project metadata
├── .editorconfig             # Code style consistency
├── .gitignore                # Git ignore rules
├── .github/                  # GitHub configuration
│   └── ISSUE_TEMPLATE/       # Issue templates
├── NovelWriter/              # Novel creation tool
├── BookEditor/               # Book editing tool
├── BookDecomposer/           # Book analysis tool
└── HerbalBookForge/          # Herbal book creation tool
```

## Development

### Prerequisites
- Modern web browser
- Git (for version control)
- Text editor (VS Code recommended)

### Local Development
```bash
# Clone the repository
git clone https://github.com/bnorth12/AI-Book-Tools.git
cd AI-Book-Tools

# Start a local server (optional)
npm run serve
# or
python -m http.server 8000

# Open index.html in your browser
```

### Code Quality
- Follow the `.editorconfig` settings for consistent formatting
- Test changes across different browsers
- Ensure API keys are never committed to version control

## API Key Guidance

These tools authenticate using API keys entered in the browser UI.

- Do not store API keys in source files.
- Do not commit API key files such as `.env`, `*.key`, or `*.secret`.
- Use the input fields in the app to provide the key at runtime.

## Getting Help

- 📖 **User Guides**: Each tool includes detailed documentation
- 🐛 **Bug Reports**: [Create an issue](https://github.com/bnorth12/AI-Book-Tools/issues) for bugs
- 💡 **Feature Requests**: [Suggest new features](https://github.com/bnorth12/AI-Book-Tools/issues) you'd like to see
- 🤝 **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines

## Community

- ⭐ **Star this repo** if you find it helpful!
- 🍴 **Fork and contribute** improvements
- 📢 **Share feedback** through issues and discussions

## Notes

- This is a static web project; no build step is required.
- The `.gitignore` file is configured to keep local secrets and temporary files out of version control.
