class ConfigManager {
    private variablePool: Map<string, string>;

    constructor() {}

    get(variable: string) {
        
    }

    set(variable: string, value: string) {
        this.variablePool.set(variable, value);
    }
    
}

export default new ConfigManager();