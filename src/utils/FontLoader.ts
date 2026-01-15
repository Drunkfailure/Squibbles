/**
 * FontLoader - Loads and registers custom fonts
 */

export class FontLoader {
  private static loaded: boolean = false;
  private static fontName: string = 'Minecraft';
  
  /**
   * Load the Minecraft font
   */
  static async loadMinecraftFont(): Promise<void> {
    if (this.loaded) {
      return;
    }
    
    try {
      // Load font using FontFace API
      const fontFace = new FontFace(
        this.fontName,
        `url(Assets/Minecraft.ttf)`
      );
      
      await fontFace.load();
      document.fonts.add(fontFace);
      
      this.loaded = true;
      console.log('Minecraft font loaded successfully');
    } catch (error) {
      console.warn('Failed to load Minecraft font, using fallback:', error);
      this.loaded = false;
    }
  }
  
  /**
   * Get the font family name to use (with fallback)
   */
  static getFontFamily(): string {
    return this.loaded ? this.fontName : 'Arial';
  }
  
  /**
   * Check if font is loaded
   */
  static isLoaded(): boolean {
    return this.loaded;
  }
}
