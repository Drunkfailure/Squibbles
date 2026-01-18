/**
 * StatsRecorder - Records simulation statistics over time for graphing
 * Designed to be extensible for any new stats/traits added later
 */

export interface DataPoint {
  time: number; // Simulation time in seconds
  [key: string]: number | undefined;
}

export interface StatConfig {
  name: string;
  label: string;
  color: string;
  category: string;
  enabled: boolean;
}

export class StatsRecorder {
  private dataPoints: DataPoint[] = [];
  private statConfigs: Map<string, StatConfig> = new Map();
  private recordInterval: number = 1.0; // Record every N seconds
  private lastRecordTime: number = 0;
  private simulationTime: number = 0;
  
  constructor(recordInterval: number = 1.0) {
    this.recordInterval = recordInterval;
    this.initializeDefaultStats();
  }
  
  /**
   * Initialize default stat configurations
   * New stats can be registered dynamically
   */
  private initializeDefaultStats(): void {
    // Population stats
    this.registerStat('population', 'Population', '#4CAF50', 'population');
    this.registerStat('births', 'Births (cumulative)', '#8BC34A', 'population');
    this.registerStat('deaths', 'Deaths (cumulative)', '#F44336', 'population');
    
    // Health stats
    this.registerStat('avg_hunger', 'Avg Hunger', '#FF9800', 'health');
    this.registerStat('avg_thirst', 'Avg Thirst', '#2196F3', 'health');
    this.registerStat('avg_health', 'Avg Health', '#E91E63', 'health');
    
    // Trait stats
    this.registerStat('avg_speed', 'Avg Speed', '#9C27B0', 'traits');
    this.registerStat('avg_vision', 'Avg Vision', '#00BCD4', 'traits');
    this.registerStat('avg_attractiveness', 'Avg Attractiveness', '#FF4081', 'traits');
    this.registerStat('avg_virility', 'Avg Virility', '#7C4DFF', 'traits');
    this.registerStat('avg_max_age', 'Avg Max Age', '#795548', 'traits');
    this.registerStat('avg_intelligence', 'Avg Intelligence', '#3F51B5', 'traits');
    this.registerStat('avg_swim', 'Avg Swim', '#009688', 'traits');
    this.registerStat('avg_metabolism', 'Avg Metabolism', '#FF5722', 'traits');
    this.registerStat('avg_damage_resistance', 'Avg Damage Resistance', '#9E9E9E', 'traits');
    this.registerStat('avg_aggressiveness', 'Avg Aggressiveness', '#F44336', 'traits');
    this.registerStat('avg_damage', 'Avg Damage', '#E91E63', 'traits');
    
    // Behavior stats
    this.registerStat('seeking_food_count', 'Seeking Food', '#FFC107', 'behavior');
    this.registerStat('seeking_mate_count', 'Seeking Mate', '#E91E63', 'behavior');
    this.registerStat('pregnant_count', 'Pregnant', '#9C27B0', 'behavior');
    this.registerStat('breeding_count', 'Breeding', '#F44336', 'behavior');
    
    // Food stats
    this.registerStat('available_food', 'Available Food', '#4CAF50', 'resources');
    
    // Gender distribution
    this.registerStat('male_count', 'Males', '#2196F3', 'demographics');
    this.registerStat('female_count', 'Females', '#E91E63', 'demographics');
  }
  
  /**
   * Register a new stat to record
   */
  registerStat(name: string, label: string, color: string, category: string): void {
    this.statConfigs.set(name, {
      name,
      label,
      color,
      category,
      enabled: true,
    });
  }
  
  /**
   * Enable or disable a stat
   */
  setStatEnabled(name: string, enabled: boolean): void {
    const config = this.statConfigs.get(name);
    if (config) {
      config.enabled = enabled;
    }
  }
  
  /**
   * Record a data point with current stats
   */
  record(stats: Record<string, number | undefined>): void {
    const dataPoint: DataPoint = {
      time: this.simulationTime,
      ...stats,
    };
    this.dataPoints.push(dataPoint);
  }
  
  /**
   * Update recorder - call every frame
   * Returns true if a new data point was recorded
   */
  update(dt: number, stats: Record<string, number | undefined>): boolean {
    this.simulationTime += dt;
    
    if (this.simulationTime - this.lastRecordTime >= this.recordInterval) {
      this.record(stats);
      this.lastRecordTime = this.simulationTime;
      return true;
    }
    return false;
  }
  
  /**
   * Get all recorded data points
   */
  getDataPoints(): DataPoint[] {
    return this.dataPoints;
  }
  
  /**
   * Get data for a specific stat
   */
  getStatData(statName: string): { time: number; value: number }[] {
    return this.dataPoints
      .filter(dp => dp[statName] !== undefined)
      .map(dp => ({
        time: dp.time,
        value: dp[statName] as number,
      }));
  }
  
  /**
   * Get all registered stat configs
   */
  getStatConfigs(): StatConfig[] {
    return Array.from(this.statConfigs.values());
  }
  
  /**
   * Get stat configs by category
   */
  getStatsByCategory(category: string): StatConfig[] {
    return this.getStatConfigs().filter(s => s.category === category);
  }
  
  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.statConfigs.forEach(config => categories.add(config.category));
    return Array.from(categories);
  }
  
  /**
   * Get config for a specific stat
   */
  getStatConfig(name: string): StatConfig | undefined {
    return this.statConfigs.get(name);
  }
  
  /**
   * Get simulation duration
   */
  getDuration(): number {
    return this.simulationTime;
  }
  
  /**
   * Clear all recorded data
   */
  clear(): void {
    this.dataPoints = [];
    this.simulationTime = 0;
    this.lastRecordTime = 0;
  }
  
  /**
   * Export data as JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      duration: this.simulationTime,
      recordInterval: this.recordInterval,
      stats: Array.from(this.statConfigs.values()),
      data: this.dataPoints,
    }, null, 2);
  }
  
  /**
   * Export data as CSV
   */
  exportCSV(): string {
    if (this.dataPoints.length === 0) return '';
    
    // Get all unique keys
    const allKeys = new Set<string>();
    this.dataPoints.forEach(dp => {
      Object.keys(dp).forEach(key => allKeys.add(key));
    });
    
    const headers = Array.from(allKeys);
    const lines: string[] = [headers.join(',')];
    
    for (const dp of this.dataPoints) {
      const values = headers.map(h => dp[h] ?? '');
      lines.push(values.join(','));
    }
    
    return lines.join('\n');
  }
}
