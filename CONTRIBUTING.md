# Contributing to AI Book Tools

Thank you for your interest in contributing to AI Book Tools! This document provides guidelines for contributing to the project.

## Ways to Contribute

### 🐛 Reporting Bugs

- Use the bug report template when creating issues
- Include detailed steps to reproduce the problem
- Mention your browser and operating system
- Attach screenshots if applicable

### 💡 Suggesting Features

- Check if the feature has already been requested
- Describe the problem you're trying to solve
- Explain how the feature would work
- Reference shared data model work when relevant, such as `schema/novel-schema-1.0.json`
- Consider alternative solutions

### 🛠️ Code Contributions

- Fork the repository
- Create a feature branch from `main`
- Make your changes
- Test thoroughly
- Submit a pull request

## Development Setup

1. **Prerequisites**
   - Modern web browser (Chrome, Firefox, Safari, Edge)
   - Text editor (VS Code recommended)
   - Git for version control

2. **Local Development**

   ```bash
   git clone https://github.com/bnorth12/AI-Book-Tools.git
   cd AI-Book-Tools
   # Open index.html in your browser
   ```

3. **Testing Changes**
   - Test all tools in multiple browsers
   - Verify API key functionality
   - Check responsive design on different screen sizes
   - For manual Playwright execution and failure triage, follow [TESTING_MANUAL_RUNBOOK.md](TESTING_MANUAL_RUNBOOK.md)

## Code Style Guidelines

### HTML

- Use semantic HTML elements
- Include alt text for images
- Maintain consistent indentation (4 spaces)

### JavaScript

- Use modern ES6+ features when appropriate
- Add comments for complex logic
- Handle errors gracefully
- Avoid global variables when possible

### CSS

- Use consistent naming conventions
- Prefer CSS custom properties for theming
- Ensure responsive design principles

## Pull Request Process

1. **Before Submitting**
   - Update documentation if needed
   - Add tests for new features
   - Ensure all tests pass
   - Update version numbers if appropriate

2. **Pull Request Template**
   - Describe the changes made
   - Reference any related issues
   - List any breaking changes
   - Include screenshots for UI changes

3. **Review Process**
   - Maintainers will review your PR
   - Address any requested changes
   - Once approved, your PR will be merged

## Version Numbering

We use [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

## Release Provenance Policy

For official releases, the repository MUST tag the exact commit that passed the final required test suites.

1. Run required suites and collect evidence (logs/report/artifacts).
2. Freeze code at the tested commit (no additional code changes).
3. Bump versions/changelog as needed and re-run required checks if those edits change release content.
4. Create an annotated release tag for that exact commit.
5. Publish release notes that reference the tag and test evidence.

Release policy rules:

- Do not tag a commit that was not the one validated by the final release test pass.
- If any commit is added after final test pass, run release validation again before tagging.
- Keep issue/PR links and test evidence in the release PR to maintain traceability.

For end-to-end feature release process requirements (create/design/implement/test/close) including configuration and data management controls, use [FEATURE_RELEASE_SSDL_CHECKLIST.md](FEATURE_RELEASE_SSDL_CHECKLIST.md).

## License

By contributing to this project, you agree that your contributions will be licensed under the same MIT License that covers the project.

## Questions?

If you have questions about contributing, please create an issue with the "question" label or contact the maintainers.

Thank you for helping make AI Book Tools better! 🎉
