const ts = require('typescript');
const path = require('path');
const fs = require('fs');

// Read tsconfig
const configPath = path.join(__dirname, 'tsconfig.json');
const configText = fs.readFileSync(configPath, 'utf8');
const { config } = ts.parseConfigFileTextToJson(configPath, configText);

// Parse the config
const parsedConfig = ts.parseJsonConfigFileContent(
  config,
  ts.sys,
  path.dirname(configPath)
);

// Create program
const program = ts.createProgram(
  parsedConfig.fileNames,
  parsedConfig.options
);

// Get diagnostics
const diagnostics = [
  ...program.getSemanticDiagnostics(),
  ...program.getSyntacticDiagnostics(),
  ...program.getDeclarationDiagnostics()
];

// Report diagnostics
if (diagnostics.length > 0) {
  console.log(`Found ${diagnostics.length} TypeScript errors:\n`);
  
  diagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      const fileName = path.relative(__dirname, diagnostic.file.fileName);
      console.log(`${fileName}:${line + 1}:${character + 1} - ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });
  
  process.exit(1);
} else {
  console.log('✅ TypeScript compilation successful - no errors found!');
  process.exit(0);
}
