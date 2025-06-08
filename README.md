# Caltally

A Chrome extension that analyzes time spent across all your Google Calendar categories with beautiful visualizations.

## Setup

1. Clone the repository
2. Copy `config.example.js` to `config.js`
3. Get your OAuth 2.0 Client ID from the [Google Cloud Console](https://console.cloud.google.com):
   - Create a new project or select an existing one
   - Enable the Google Calendar API
   - Go to "APIs & Services" > "Credentials"
   - Create an OAuth 2.0 Client ID
   - Set the application type to "Chrome Extension"
   - Add your extension ID to the authorized JavaScript origins
4. Add your Client ID to `config.js`
5. Generate the manifest file if not present:
   ```bash
   node build.js
   ```
6. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Usage

### Sign In
1. Click the Caltally icon in your Chrome toolbar
2. Click the "Sign in with Google" button
3. Grant the requested permissions when prompted

### View Calendar Analysis
After signing in, you'll see:
- A list of your calendars on the left
- A summary of your time allocation
- visualizations of your calendar data

### Features
- **Calendar Selection**: Choose which calendars to analyze
- **Time Analysis**: See how your time is distributed across different categories
- **Visualizations**: 
  - Pie charts showing category distribution
  - Bar charts for time trends
  - Calendar heat maps for busy periods
- **Export**: Download your analysis as CSV or PDF

### Tips
- Use calendar colors consistently for better category analysis
- Add descriptive event titles for more accurate categorization
- Regular sync ensures your analysis is up to date

## Development

The extension uses:
- Chrome Extension Manifest V3
- Google Calendar API
- Chrome Identity API for OAuth

### Build Process

The extension uses a build process to generate the `manifest.json` file from a template. This allows us to keep sensitive information like the OAuth client ID in a separate configuration file.

To rebuild the manifest after making changes:
```bash
node build.js
```

## Security

- The extension only requests read-only access to your calendar data

## Troubleshooting

### Common Issues
1. **Sign-in fails**
   - Check your internet connection
   - Verify your OAuth client ID is correct
   - Ensure the Calendar API is enabled in Google Cloud Console

2. **No calendars appear**
   - Verify you have calendars in your Google Calendar
   - Check that you've granted calendar access permissions
   - Try signing out and back in

3. **Data not updating**
   - Click the refresh button
   - Check your internet connection
   - Verify the extension has the necessary permissions

## License

MIT License 