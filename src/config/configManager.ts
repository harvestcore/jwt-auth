import dotenv from 'dotenv';

class ConfigManager {
    private variablePool: Map<string, string>;

    constructor() {
        this.variablePool = new Map();
        dotenv.config();
    }

    get(variable: string): any {
        const fromPool = this.variablePool.get(variable);

        if (fromPool) {
            return fromPool;
        } else {
            const fromEnv = process.env[variable];
            if (fromEnv) {
                this.set(variable, fromEnv);
                return fromEnv;
            }

            return undefined;
        }
    }

    set(variable: string, value: string) {
        this.variablePool.set(variable, value);
    }
}

export default new ConfigManager();
