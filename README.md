# Lilypad Next

**Lilypad Next** is a completely **rewritten** built on **Electron**, designed to bring the **Just Dance Console** experience to your desktop with massive enhancements. While it originated as a fork of the original Lilypad project, the core engine has been rebuilt from scratch, focusing on performance, accuracy, and a true console-like feel.

---

## 🌟 Why Lilypad Next?

Lilypad Next isn't just a clone; it's a major overhaul. Unlike the original project, which was largely unfinished and ran entirely in the renderer, Lilypad Next features a split **Electron backend and renderer**, leading to far **better optimization**—it feels like a native Just Dance console game!

### Key Enhancements

* **A Real—Scoring System!:** We're able to recreate their msm and gesture parsing system.
* **Zero-install Phone Controller!:** To play the game you don't need to download the apps! You just need to open your browser!.
* **UbiArt Timeline Support (JD16–22):** Full compatibility with Just Dance UbiArt assets (like **`.tpl.ckd`**, **`.dtape.ckd`**, **`.isc.ckd`**), requiring PC, X1, or PS4 MainScene/texture formats.
* **Enhanced Media Support:** Now supports multiple video formats (**webm, mp4, mkv**) but requires **separate audio files** (**ogg, opus, or mp3**) for better control and synchronization.
* **Upgraded UI:** While some elements from the original remain, most of the frontend is new, and the backend logic is completely different for superior performance.

---

## 🚀 Features

* **Accurate Skeleton/Move Tracking:** Features code to analyze your skeleton and movements, functioning identically to official Just Dance tracking and utilizing the serialized **`.msm`** and **`.gesture`** files.
* **Multiplayer Dance Parties:** Up to **6 players** can dance together at once, perfect for parties and group fun.
* **Clean, Real-Time Feedback UI:** A new interface with animated effects and move-by-move star ratings to keep your sessions engaging.
* **Streamlined Development:** We've replaced scattered scene files with a smooth **webpack** setup for easier development.

---

## 🛠️ Getting Started

### Prerequisites

* **Node.js v20** or later (and **npm**)
* A **Windows PC** (for `start.cmd`) or a cross-platform terminal

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/mfadamo/lilypad-next.git LilypadNext/
cd LilypadNext

# 2. Install dependencies
npm install
````

### Running the Game (Windows)

Simply run the following command in PowerShell:

```powershell
PS F:\e\LilypadNext> .\start.cmd
```

This script will automatically:

1.  Build the project with Webpack.
2.  Launch the game using Electron.

## 🎵 Maps & Assets

The file structure is designed to feel familiar to UbiArt developers. Every song is self-contained within its own folder inside `/rootOfDrive:/LilypadData/maps/{song}`, closely following the UbiArt-style bundle layout for easy management.

NOTE: While UbiArt uses separated cooked and raw files, Lilypad-Next requiring to merge them into one folder.

-----

## ⚠️ Current Development Status

Lilypad Next is under active development. Some features are still being worked on:

  * The Gesture Scoring Library is present, but **built-in camera support is not yet implemented**.
  * **Just Dance Now's online server support** has been removed and no longer supported.
  * Some **textures and assets** require repair.
  * **Missing features** that need to be added include song previews, a proper UI design for menus, playlists, score saving, and a settings menu.

-----

## 🤝 Want to Contribute?

We welcome all contributions\! If you have ideas, suggestions, or want to fix a bug, please check out the contribution guidelines.

1.  **Fork** the repository.
2.  Create a **feature branch**.
3.  Open a **pull request** with your changes.

More info can be found in **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

-----

## 📄 License

Lilypad Next is an open-source project released under the **MIT License**. See **[LICENSE](./LICENSE)** for details.