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
├── index.html                               # Main launcher page
├── README.md                                # This file
├── CONTRIBUTING.md                          # Contribution guidelines
├── CHANGELOG.md                             # Version history
├── LICENSE                                  # MIT License
├── package.json                             # Project metadata
├── playwright.config.js                     # Playwright configuration
├── web.config                               # IIS/local static server config
├── NovelWriter/                             # App: Novel creation tool (IIS-served)
├── BookEditor/                              # App: Book editing tool (IIS-served)
├── BookDecomposer/                          # App: Book analysis tool (IIS-served)
├── HerbalBookForge/                         # App: Herbal workflow tool (IIS-served)
├── shared/                                  # Shared UI tokens/assets
├── schema/                                  # Shared schema + samples
├── tests/
│   └── e2e/                                 # Playwright specs
├── scripts/
│   └── governance/                          # Governance validation scripts
├── releases/                                # Versioned release snapshot packages
├── docs/
│   ├── governance/                          # SSDLC policies/status
│   ├── runbooks/                            # Manual testing runbooks
│   ├── releases/                            # Release closeout reports
│   ├── roadmap/                             # Planning and roadmap docs
│   ├── architecture/ui-unification/         # UI unification analysis and evidence
│   ├── system-security-analysis/             # Threat model and cyber threat analysis artifacts
│   ├── integration/                         # Cross-tool integration issue docs
│   └── community/                           # Community setup docs
└── .github/                                 # GitHub configuration and templates
```

## Development

Documentation index: [docs/README.md](docs/README.md)

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

For manual, human-operated Playwright execution and live failure analysis, see [docs/runbooks/TESTING_MANUAL_RUNBOOK.md](docs/runbooks/TESTING_MANUAL_RUNBOOK.md).

For secure feature release lifecycle policy (planning through closeout), see [docs/governance/FEATURE_RELEASE_SSDL_CHECKLIST.md](docs/governance/FEATURE_RELEASE_SSDL_CHECKLIST.md).

For canonical threat model and cyber threat analysis artifacts, see [docs/system-security-analysis/README.md](docs/system-security-analysis/README.md).

For release snapshot packaging policy and folder requirements, see [docs/governance/RELEASE_PACKAGE_POLICY.md](docs/governance/RELEASE_PACKAGE_POLICY.md).

### Shared Design System

UI unification artifacts and standards are documented under:

- `docs/architecture/ui-unification/UI_UNIFICATION_REQUIREMENT_INDEX.md`
- `docs/architecture/ui-unification/UI_UNIFICATION_MIGRATION_NOTES.md`
- `docs/architecture/ui-unification/UI_UNIFICATION_VISUAL_CONSISTENCY_CHECKLIST.md`
- `docs/architecture/ui-unification/UI_UNIFICATION_RELEASE_EVIDENCE_BUNDLE.md`

These documents define tokenized shell conventions, migration compatibility rules,
visual consistency checks, and evidence expectations for release closeout.

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
