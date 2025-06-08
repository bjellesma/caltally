const fs = require('fs');
const path = require('path');

// Read the config file
const config = require('./config.js').default;

// Read the template
const template = fs.readFileSync('manifest.template.json', 'utf8');

// Replace the placeholder with the actual client ID
const manifest = template.replace('{{CLIENT_ID}}', config.oauth.client_id);

// Write the manifest file
fs.writeFileSync('manifest.json', manifest);

console.log('Manifest file generated successfully!'); 