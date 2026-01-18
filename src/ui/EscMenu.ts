/**
 * EscMenu - Pause menu accessible via ESC key
 */

export interface EscMenuResult {
  action: 'resume' | 'settings' | 'returnToTitle';
}

export class EscMenu {
  private container: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private resolveCallback: ((result: EscMenuResult) => void) | null = null;
  
  /**
   * Show the ESC menu and return a promise that resolves when an action is selected
   */
  show(): Promise<EscMenuResult> {
    if (this.isVisible) {
      return new Promise((resolve) => {
        this.resolveCallback = resolve;
      });
    }
    
    this.isVisible = true;
    this.createMenu();
    
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
    });
  }
  
  /**
   * Hide the menu
   */
  hide(): void {
    this.isVisible = false;
    if (this.container) {
      if (this.container.parentNode) {
        document.body.removeChild(this.container);
      }
      this.container = null;
    }
  }
  
  /**
   * Check if menu is visible
   */
  isMenuVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Create the menu DOM elements
   */
  private createMenu(): void {
    // Remove existing menu if present
    if (this.container) {
      this.hide();
    }
    
    // Main container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Minecraft', 'Segoe UI', Arial, sans-serif;
    `;
    
    // Menu panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #1a1a2e;
      border: 3px solid #4a4a6a;
      border-radius: 10px;
      padding: 40px;
      min-width: 400px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    // Title
    const title = document.createElement('h1');
    title.textContent = 'Pause Menu';
    title.style.cssText = `
      margin: 0 0 30px 0;
      color: #fff;
      font-size: 32px;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    panel.appendChild(title);
    
    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 15px;
    `;
    
    // Resume button
    const resumeBtn = this.createButton('Resume (ESC)', () => {
      this.selectAction('resume');
    }, '#4CAF50');
    buttonsContainer.appendChild(resumeBtn);
    
    // Settings button (placeholder)
    const settingsBtn = this.createButton('Settings (Coming Soon)', () => {
      this.selectAction('settings');
    }, '#2196F3', true); // Disabled
    buttonsContainer.appendChild(settingsBtn);
    
    // Return to title button
    const returnBtn = this.createButton('Return to Title Screen', () => {
      this.selectAction('returnToTitle');
    }, '#e74c3c');
    buttonsContainer.appendChild(returnBtn);
    
    panel.appendChild(buttonsContainer);
    this.container.appendChild(panel);
    document.body.appendChild(this.container);
    
    // Handle ESC key to resume
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isVisible) {
        e.preventDefault();
        e.stopPropagation();
        this.selectAction('resume');
      }
    };
    
    window.addEventListener('keydown', escHandler);
    
    // Store handler for cleanup
    (this.container as any).__escHandler = escHandler;
  }
  
  /**
   * Create a styled button
   */
  private createButton(
    text: string,
    onClick: () => void,
    bgColor: string = '#3498db',
    disabled: boolean = false
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 15px 30px;
      background: ${disabled ? '#555' : bgColor};
      color: white;
      border: none;
      border-radius: 5px;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      font-size: 18px;
      font-family: 'Minecraft', 'Segoe UI', Arial, sans-serif;
      transition: all 0.2s;
      opacity: ${disabled ? '0.6' : '1'};
      pointer-events: ${disabled ? 'none' : 'auto'};
    `;
    
    if (!disabled) {
      btn.onmouseover = () => {
        btn.style.opacity = '0.8';
        btn.style.transform = 'scale(1.05)';
      };
      btn.onmouseout = () => {
        btn.style.opacity = '1';
        btn.style.transform = 'scale(1)';
      };
      btn.onclick = onClick;
    }
    
    return btn;
  }
  
  /**
   * Select an action and resolve the promise
   */
  private selectAction(action: EscMenuResult['action']): void {
    // Clean up ESC handler
    if (this.container && (this.container as any).__escHandler) {
      window.removeEventListener('keydown', (this.container as any).__escHandler);
    }
    
    this.hide();
    
    if (this.resolveCallback) {
      this.resolveCallback({ action });
      this.resolveCallback = null;
    }
  }
}
