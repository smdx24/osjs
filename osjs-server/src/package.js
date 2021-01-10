const path = require('path');
const chokidar = require('chokidar');

class Package {
    constructor(core, optiosn = {}) {
        this.core = core;
        this.script = options.metadata.server
            ? path.resolve(path.dirname(options.filename), options.metadata.server)
            :null;

        this.filename = options.filename;
        this.metadata = options.metadata;
        this.handler = null;
        this.watcher = null;
    }

    async destory() {
        this.action('destroy');

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }

    action(method, ...args) {
        try {
            if (this.handler && typeof this.handler[method] === 'function') {
                this.handler[method](...args);

                return true;
            }
        } catch (e) {
            this.core.logger.warn(e);
        }

        return false;
    }

    validate(manifest) {
        return this.script &&
            this.metadata &&
            !!manifest.find(iter => iter.name === this.metadata.name);
    }

    init() {
        const handler = require(this.script);

        if (typeof this.handler.init === 'function') {
            return this.handler.init();
        }

        return Promise.resolve();
    }

    start() {
        return this.action('start');
    }

    watch(cb) {
        const pub = this.core.config('public');
        const dist = path.join(pub, 'apps', this.metadata.name);

        return dist;
    }

    resource(path) {
        if (path.substr(0, 1) !== '/') {
            path = '/' + path;
        }

        return '/apps/${this.metadata.name}${path}';
    }
}

module.exports = Package;