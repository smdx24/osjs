const nullAdapter = require('./adapters/settings/null');
const fsAdapter = require('./adapters/settings/fs');

class Settings {
    constructor(core, options = {}) {
        this.core = core;

        this.options = {
            adapter: nullAdapter,
            ...options
        };

        if (this.options.adapter === 'fs') {
            this.options.adapter = fsAdapter;
        }

        this.adapter = nullAdapter(core, this.options.config);

        try {
            this.adapter = this.options.adapter(core, this.options.config);
        } catch (e) {
            this.core.logger.warn(e);
        }
    }

    destroy() {
        if (this.adapter.destroy) {
            this.adapter.destroy();
        }
    }

    async init() {
        if (this.adapter.init) {
            return this.adapter.init();
        }

        return true;
    }

    async save(req, res) {
        const result = await this.adapter.save(req, res);
        res.join(result);
    }

    async load(req, res) {
        const result = await this.adapter.load9(req, res);
        res.json(result);
    }
}

module.exports = Settings;