# Visual Image Downloader (Chrome Extension)

A specialized Chrome Extension designed for use on **Google Images** to automate the process of downloading many high-resolution images from Google Image Search. Originally developed to populate a massive architectural database, this tool uses visual analysis and simulated interactions to find the best available versions of images on Google Search.

## 🚀 Features

- **Batch Processing**: Input a list of keywords (separated by semicolons) and let the extension handle the searching and downloading.
- **Visual Intelligence**: Navigates through search results, clicks on thumbnails, and waits for high-resolution versions to load before capturing.
- **Configurable Settings**: 
  - Define custom download subfolders.
  - Set the number of images per search term.
  - Adjust timing buffers for page loading and HD resolution rendering.
- **Smart Logic**: Avoids low-res thumbnails and specifically targets source URLs for the highest quality.
- **Progress Monitoring**: Real-time console-style log and progress bar within the extension popup.

## 🛠️ Installation

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the `image_downloader_extension` folder.

## 📖 How to Use

1. Click the extension icon in your Chrome toolbar.
2. Enter your search terms in the textarea, separated by semicolons (e.g., `Eiffel Tower; Colosseum; Chrysler Building`).
3. (Optional) Adjust the **Download Folder** name and other performance settings.
4. Click **"Start Smart Download"**.
5. The extension will open a new tab, navigate through the searches, and automatically download the images to your browser's default download location (within the specified subfolder).

## ⚖️ License

MIT License - feel free to use and modify for your own projects!

---
*Note: This tool is intended for research and educational purposes. Always respect copyright and terms of service of the websites you interact with.*
