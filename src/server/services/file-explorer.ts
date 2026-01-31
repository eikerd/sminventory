import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

/**
 * FileExplorer - Open files/folders in native file explorer
 */
export class FileExplorer {
  /**
   * Open a file or folder in the system file explorer
   */
  static open(filepath: string): void {
    if (!fs.existsSync(filepath)) {
      throw new Error(`File or folder not found: ${filepath}`);
    }

    const platform = process.platform;

    try {
      if (platform === "darwin") {
        // macOS
        execSync(`open -R "${filepath}"`);
      } else if (platform === "win32") {
        // Windows
        execSync(`explorer /select,"${filepath}"`);
      } else if (platform === "linux") {
        // Linux - try different file managers
        try {
          // Try nautilus (GNOME)
          execSync(`nautilus "${filepath}" &`);
        } catch {
          try {
            // Try dolphin (KDE)
            execSync(`dolphin "${filepath}" &`);
          } catch {
            try {
              // Try thunar (XFCE)
              execSync(`thunar "${filepath}" &`);
            } catch {
              // Fallback: just open the directory
              const dir = fs.statSync(filepath).isDirectory() ? filepath : path.dirname(filepath);
              execSync(`xdg-open "${dir}" &`);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to open file explorer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Open folder containing a file
   */
  static openFolder(filepath: string): void {
    const dir = path.dirname(filepath);
    this.open(dir);
  }
}

export const fileExplorer = FileExplorer;
