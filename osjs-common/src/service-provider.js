export class ServiceProvider {
    constructor(core, options = {}) {
        this.core = core;
        this.options = options;
    }

    provides() {
        return [];
    }

    depends() {
        return [];
    }

    async init() {
    }

    start() {
    }

    destroy() {
    }
}