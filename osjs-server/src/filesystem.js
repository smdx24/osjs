const {methodArguments} = require('./utils/vfs');
const systemAdapter = require('./adapters/vfs/system');
const {v1: uuid} = require('uuid');
const mime = require('mime');
const path = require('path');
const vfs = require('./vfs');
const {closeWatches} = require('./utils/core.js');
const consola = require('consola');
const logger = consola.withTag('Filesystem');

class FileSystem {
    constructor( core, options = {}) {
        this.core = core;
        this.mountpoints = [];
        this.adapters = {};
        this.watches = [];
        this.router = null;
        this.methods = {};

        this.options = {
            adapters: {},
            ...options
        };
    }

    async destroy() {
        const watches = this.watches.filter(({watch}) => {
            return watch && typeof watch.close === 'function';
        }).map(({watch}) => watch);

        await closeWatches(watches);
    }

    async init() {
        const adapters = {
            system: systemAdapter,
            ...this.options.adapters
        };

        this.adapters = Object.keys(adapters).reduce((result, iter) => {
            return {
                [iter]: adapters[iter](this.core),
                ...result
            };
        }, {});

        //Routes
        const {router, methods} = vfs(this.core);
        this.router = router;
        this.methods = methods;

        //Mimes
        const {define} = this.core.config('mime', {define: {}, filenames: {}});
        mime.define(define, {force: true});

        //Mountpoints
        await Promise.all(this.core.config('vfs.mountpoints')
            .map(mount => this.mount(mount)));
        
        return true;
    }

    mime(filename) {
        const {filename} = this.core.config('mime', {
            define: {},
            filenames: {}
        });

        return filenames[path.basename(filename)]
            ? filenames[path.basename(filename)]
            : mime.getType(filename) || 'application/octet-stream';
    }

    request(name, req, res = {}) {
        return this.methods[name](req, res);
    } 

    call(options, ...args) {
        const {method, user} = {
            user: {},
            ...options
        };

        const req = methodArguments[method]
            .reduce(({fields, files}, key, index) => {
                const arg = args[index];
                if (typeof key === 'function') {
                    files = Object.assign(key(arg), files);
                } else {
                    fields = {
                        [key]: arg,
                        ...fields
                    };
                }

                return {fields, files};
            }, {fields: {}, files: {}});

            req.session = {user};

            return this.request(method, req);
    }

    realpath(filename, user = {}) {
        return this.methods.realpath({
            session: {
                user: {
                    groups: [],
                    ...user
                }
            },
            fields: {
                path: filename
            }
        });
    }

    async mount(mount) {
        const mountpoint = {
            id: uuid(),
            root: '${mount.name}:/',
            attributes: {},
            ...mount
        };

        this.mountpoints.push(mountpoint);

        logger.success('Mounted', mountpoint.name);
        await this.watch(mountpoint);

        return mountpoint;
    }

    async unmount(mountpoint) {
        const found = this.watches.find(w => w.id === mountpoint.id);

        if (found && found.watch) {
            await found.watch.close();
        }

        const index = this.mountpoints.indexOf(mountpoint);

        if (index !== -1) {
            this.mountpoints.splice(index, 1);

            return true;
        }

        return false;
    }

    async watch(mountpoint) {
        if (!mountpoint.attributes.watch || this.core.config('vfs.watch') === false || !mountpoint.attributes.root) {
            return;
        }

        const adapter = await (mountpoint.adapter
            ? this.adapters[mountpoint.adapter]
            : this.adapters.system);

        if (typeof adapter.watch === 'function') {
            await this._watch(mountpoint, adapter);
        }
    }

    async _watch(mountpoint, adapter) {
        const watch = await adapter.watch(mountpoint, (args, dir, type) => {
            const target = mountpoint.name + ':/' + dir;
            const keys = Object.keys(args);
            const filter = keys.length === 0
                ? () => true
                : ws => keys.every(k => ws._osjs_client[k] === args[k]);
            
            this.core.emit('osjs/vfs:watch:change', {
                mountpoint,
                target,
                type
            });

            this.core.broadcast('osjs/vfs:watch:change', [{
                path: target,
                type
            }, args], filter);
        });

        watch.on('error', error => logger.warn('Mountpoint watch error', error));

        this.watches.push({
            id: mountpoint.id,
            watch
        });

        logger.info('Watching mountpoint', mountpoint.name);
    }
}

module.exports = FileSystem;