import {resolveTreeByKey, providerHandler} from './utils.js';
import {EventEmitter} from '@osjs/event-emitter';
import merge from 'deepmerge';
import omitDeep from 'omit-deep';

export class Corebase extends EventEmitter {
    constructor(defaultConfiguration, configuration, options) {
        super('Core');

        const merger = merge.default ? merge.default : merge;
        const ommited = omitDeep(defaultConfiguration, options.omit || []);

        this.logger = console;
        this.configuration = merger(ommited, configuration);
        this.options = options;
        this.booted = false;
        this.started = false;
        this.destroyed = false;
        this.providers = providerHandler(this);
    }

    destroy() {
        if (this.destroyed) {
            return false;
        }

        this.booted = false;
        this.destroyed = true;
        this.started = false;

        const promises = this.providers.destroy();

        super.destroy();

        return promises;
    }

    boot() {
        if (this.booted) {
            return Promise.resolve(true);
        }

        this.started = false;
        this.destroyed = false;
        this.booted = true;

        return this.providers.init(true)
            .then(() => true);
    }

    start() {
        if (this.started) {
            return Promise.resolve(true);
        }

        this.started = true;

        return this.providers.init(false)
            .then(() => true);
    }

    config(key, defaultValue) {
        return key
        ? resolveTreeByKey(this.configuration, key, defaultValue)
        : Object.assign({}, this.configuration);
    }

    register(ref, options = {}) {
        this.providers.register(ref, options);
    }

    instance(name, callback) {
        this.providers.bind(name, false, callback);
    }

    singleton(name, callback) {
        this.providers.bind(name, true, callback);
    }

    make(name, ...args) {
        return this.providers.make(name, ...args);
    }

    has(name) {
        return this.providers.has(name);
    }
}