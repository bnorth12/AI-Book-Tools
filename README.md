# AI Book Tools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/bnorth12/AI-Book-Tools)](https://github.com/bnorth12/AI-Book-Tools/issues)
[![GitHub stars](https://img.shields.io/github/stars/bnorth12/AI-Book-Tools)](https://github.com/bnorth12/AI-Book-Tools/stargazers)

Static HTML/JavaScript tools for AI-assisted writing and book editing.

Current tool releases: NovelWriter 0.3.4, BookEditor 0.4.0, BookDecomposer 0.2.0, HerbalBookForge 0.9.5.

## Quick Start

1. **Download**: Clone or download this repository
2. **Open**: Launch `index.html` in your web browser
3. **Configure**: Enter your xAI API key in each tool
4. **Create**: Start writing with AI assistance!

## Project Structure

```text
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
- Run `npm test` to validate code quality

### Automated Testing

This repository uses GitHub Actions for automated testing:

- HTML validation and linting
- JSON file validation
- Code quality checks
- File size monitoring

Tests run automatically on every push and pull request.

For manual, human-operated Playwright execution and live failure analysis, see [TESTING_MANUAL_RUNBOOK.md](TESTING_MANUAL_RUNBOOK.md).

For secure feature release lifecycle policy (planning through closeout), see [FEATURE_RELEASE_SSDL_CHECKLIST.md](FEATURE_RELEASE_SSDL_CHECKLIST.md).

### Security Updates

Dependabot automatically creates pull requests to update dependencies and GitHub Actions, keeping the project secure and up-to-date.

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
- 💬 **Join our Discord** for community discussion and support

### Discord Server

We have a community Discord server for:

- Getting help with the tools
- Sharing your writing projects
- Discussing AI writing techniques
- Contributing to development
- Connecting with other writers

Server invite link will be added soon. Check back or create an issue to request access.

## Roadmap

### Planned Features

- [ ] Enhanced mobile responsiveness
- [ ] Dark/light theme toggle
- [ ] Export to multiple formats (PDF, DOCX, EPUB)
- [ ] Collaborative editing features
- [ ] Integration with other writing platforms
- [ ] Advanced AI model support

### Shared Novel Schema

- [x] Normalize `NovelWriter`, `BookEditor`, and `BookDecomposer` around a versioned shared schema
- [x] Add import/export compatibility for `schema/novel-schema-1.0.json`
- [x] Track implementation tasks in `schema/novel-schema-1.0-tasks.md`

### Version 2.0 Goals

- Improved user interface design
- Better error handling and user feedback
- Performance optimizations
- Expanded tool capabilities
- Community feature requests

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Quick Contribution Ideas

- Improve documentation and user guides
- Add new features or tools
- Fix bugs and improve stability
- Enhance mobile/tablet experience
- Create tutorials and examples

## Notes

- This is a static web project; no build step is required.
- The `.gitignore` file is configured to keep local secrets and temporary files out of version control.
