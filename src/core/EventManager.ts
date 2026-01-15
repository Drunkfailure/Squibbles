/**
 * Event Manager - handles keyboard and mouse input
 */

export type KeyCode = string;

export class EventManager {
  private keys: Set<KeyCode> = new Set();
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();
  
  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    
    window.addEventListener('mousemove', (e) => {
      this.mousePosition.x = e.clientX;
      this.mousePosition.y = e.clientY;
    });
    
    window.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(e.button);
    });
    
    window.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(e.button);
    });
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  public isKeyPressed(key: KeyCode): boolean {
    return this.keys.has(key);
  }
  
  public getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }
  
  public isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.has(button);
  }
  
  public cleanup(): void {
    // Event listeners will be cleaned up automatically when window is closed
  }
}
