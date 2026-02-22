# Setting Up Your Gemini API Key

## Quick Setup

1. **Get your API key:**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click "Create API Key"
   - Copy the generated key

2. **Enter your API key in the extension:**
   - Open the extension's side panel (click the button on any website)
   - You'll see an "API Key Setup" section
   - Paste your API key into the input field
   - Click "Save API Key" or press Enter

3. **Done!**
   - Your key is saved locally in your browser
   - The extension will now work on any page

## Environment File (Optional)

The `.env` file is provided for reference. To use it during development:

```
GEMINI_API_KEY=your_key_here
```

**Note:** The `.env` file is ignored in git (see `.gitignore`) for security. Never commit your actual API key to version control.

## How It Works

- Your API key is stored securely in your browser's local storage using `chrome.storage.local`
- It's never sent anywhere except to Google's Gemini API
- Only you can see it (it's local to your browser profile)

## Troubleshooting

- **"Please set your Gemini API key"** - The key isn't saved yet. Follow step 2 above.
- **"Error initializing system"** - Check that your API key is valid at [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Need to change your key?** - Clear the storage: Open DevTools (F12) > Application > Local Storage > Clear

