# Python Debug Tools

Python Debug Tools is a Visual Studio Code extension that provides utilities for Python debugging, making it easier to inspect and copy variables as JSON during a debug session.

## Features

- **Copy as JSON**: Right-click a variable in the debug variables view or in the editor (while debugging) and select **Copy as JSON** to copy its value as a JSON string to your clipboard.
  - Supports Python lists, tuples, sets, dictionaries, and NumPy arrays (as JSON arrays or objects).
  - Handles nested structures and common Python types.
- **Context Menu Integration**: The command is available in the debug variables context menu and the editor context menu (when in debug mode).

## Usage

1. Start a Python debugging session in VS Code.
2. In the VARIABLES panel or in the editor, right-click a variable and choose **Copy as JSON** from the context menu.
3. The variable's value will be copied to your clipboard in JSON format, ready to paste elsewhere.

## Requirements

- Visual Studio Code 1.102.0 or later
- Python debugging must be active (requires a Python debug session)

## Extension Settings

This extension does not contribute any user settings.

## Known Issues

- Only variables visible in the current stack frame and scope can be copied.
- Some complex or custom Python objects may not serialize as expected.
- NumPy arrays are converted to lists before copying as JSON.

## Release Notes

### 0.0.1

- Initial release: Copy Python variables as JSON from the debug context menu.

---

## Contributing

Contributions and feedback are welcome! Please open issues or pull requests on the [GitHub repository](https://github.com/your-repo/python-debug-tools) (replace with actual URL).

## License

Apache 2.0