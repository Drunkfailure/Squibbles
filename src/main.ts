/**
 * Squibbles Evolution Simulation - TypeScript Version
 * Main entry point
 */

import { GameSettings } from './core/Game';
import { Simulation } from './core/Simulation';
import { TitleScreen } from './ui/TitleScreen';
import { LoadingScreen } from './ui/LoadingScreen';
import { FontLoader } from './utils/FontLoader';

console.log('Squibbles TypeScript version starting...');

async function runSimulation(): Promise<void> {
  // Load Minecraft font early
  await FontLoader.loadMinecraftFont();
  
  while (true) {
    try {
      // Show title screen
      console.log('Starting title screen...');
      const titleScreen = new TitleScreen(1000, 800);
      await titleScreen.initialize();
      const settings = await titleScreen.show();
      
      if (!settings) {
        console.log('Title screen closed, exiting...');
        return;
      }
      
      console.log('Starting simulation with settings:', settings);
      
      // Show loading screen
      console.log('Showing loading screen...');
      const loadingScreen = new LoadingScreen(
        window.innerWidth,
        window.innerHeight,
        settings
      );
      await loadingScreen.initialize();
      
      // Create simulation first (but don't initialize yet)
      const simulation = new Simulation(settings);
      
      // Create progress callback that updates loading screen
      const updateProgress = (progress: number, message: string) => {
        loadingScreen.updateProgress(message, progress);
        // Force a render frame
        if (loadingScreen.getApp()) {
          loadingScreen.getApp().render();
        }
      };
      
      // Start with initial progress
      updateProgress(0, 'Initializing simulation...');
      
      // Initialize simulation with progress updates
      await simulation.initialize(updateProgress);
      
      // Clean up loading screen
      loadingScreen.cleanup();
      
      // Set up return to title callback - use a promise-based approach
      let returnToTitleResolver: (() => void) | null = null;
      const returnToTitlePromise = new Promise<void>((resolve) => {
        returnToTitleResolver = resolve;
      });
      
      simulation.setReturnToTitleCallback(() => {
        simulation.cleanup();
        // Clean up DOM
        const appElement = document.getElementById('app');
        if (appElement) {
          appElement.innerHTML = '';
        }
        if (returnToTitleResolver) {
          returnToTitleResolver();
        }
      });
      
      // Start simulation
      simulation.start();
      
      // Handle window resize
      window.addEventListener('resize', () => {
        // Will be handled by simulation in later phases
      });
      
      // Handle page unload
      window.addEventListener('beforeunload', () => {
        simulation.cleanup();
      });
      
      console.log('Game started successfully');
      
      // Wait for return to title signal
      await returnToTitlePromise;
      
    } catch (error) {
      console.error('Failed to start game:', error);
      document.getElementById('app')!.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: red; font-size: 24px;">
          <div>
            <h1>Error Starting Game</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      `;
      return; // Exit on error
    }
  }
}

async function main() {
  await runSimulation();
}

// Start the game
main();
