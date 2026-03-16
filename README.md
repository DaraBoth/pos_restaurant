# Cambodian Restaurant POS System

A high-performance, strictly offline, local-first Point of Sale system built with **Tauri v2**, **Rust**, **SQLite (SQLCipher)**, and **Next.js (React)**.

## Quick Start (Zero-Config Build)

This project has been configured so that anyone can clone it and run it immediately **without needing to set up a database, configure `.env` files, or manually create tables.** The Rust backend will automatically initialize, encrypt, and migrate the local SQLite database upon launch.

### Prerequisites

You only need the two standard compiler toolchains for Tauri:

1. **[Node.js](https://nodejs.org/)** (v18 or higher)
2. **[Rust](https://rustup.rs/)** (v1.75 or higher)
   * _Windows Users:_ The Rust installer will ask you to install the C++ Build Tools for Visual Studio 2022. Please accept this, as Native desktop apps require it.

> **Note:** If you just installed Rust, please **restart your terminal or Visual Studio Code** before continuing so the `cargo` command is recognized.

### Running the App

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DaraBoth/pos_restaurant.git
   cd pos_restaurant
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Start the Development Desktop App:**
   ```bash
   npm run tauri:dev
   ```
   *The very first time you run this, Rust will download and compile all the backend dependencies. This may take 2-5 minutes depending on your internet and CPU speed. Subsequent runs will be nearly instant.*

### Building an Installer (.msi / .exe)

To package the application into a standalone installer that you can put on a USB drive and install gracefully on the restaurant's tablets:

```bash
npm run tauri:build
```

The installer will be generated in `src-tauri/target/release/bundle/`.

## Architecture Details

* **Frontend:** Next.js configured in pure static export mode (`output: 'export'`), styled with TailwindCSS, executing completely offline.
* **Backend:** Tauri Rust shell handling all OS-level operations and hosting the SQLite driver.
* **Database:** Embedded SQLite database (`%AppData%/summer/local.db`) transparently encrypted at rest natively using AES-256 (via `sqlx` and `sqlcipher`).
* **Security:** Passwords are mathematically hashed locally using the memory-hard `Argon2` algorithm.
* **Calculations:** Dual-currency USD/KHR checkout logic with integrated 10% VAT and 3% PLT auto-calculation. KHR calculations implement the required Base-100 roundings specified by the GDT/NBC.
