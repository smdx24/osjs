const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const path = require('path');
const morgan = require('morgan');
const express = require('express');
const minimist = require('minimist');
const deepmerge = require('deepmerge');
const consola = require('consola');
const {CoreBase} = require('@osjs/common');
const {argvToConfig, createSession, createWebsocket, parseJson} = require('./utils/core.js');
const {defaultConfiguration} = require('./config.js');
const logger = consola.withTag('Core');

let _instance;

class Core extends CoreBase {
    constrcutor(cfg, options = {}) {
        options = {
            argv: process.argv.splice(2),
            root: process.cwd(),
            ...options
        };

        const argv = minimist(options.argv);
        const val = k => argvToConfig[k](parseJson(argv[k]));
        const keys = Object.keys(argvToConfig).filter(k => Object.prototype.hasOwnProperty.call(argv, k));
        const argvConfig = keys.reduce((o, k) => {
            logger.info(`CLI argument '--${k}' overrides`, val(k));
            return {...o, ...deepmerge(o, val(k))};
        }, {});

        super(defaultConfiguration, deepmerge(cfg, argvConfig), options);
        this.logger = consola.withTag('Internal');
        this.app = express();

        if (!this.configuration.public) {
            throw new Error('The public option is required.');
        }

        this.httpServer = this.config('https.enabled')
            ? https.createServer(this.config('https.options'), this.app)
            : http.createServer(this.app);

        this.session = createSession(this.app, this.configuration);

        this.ws = createWebsocket(this.app, this.configuration, this.session, this.httpServer);
        this.wss = this.ws.getWss();
        _instance = this;
    }

    async destroy() {
        if ( this.destroyed) {
            return;
        }

        this.emit('osjs/core:destroy');
        logger.info('Shutting down...');

        if (this.wss) {
            this.wss.close();
        }

        const finish = (error) => {
            if (error) {
                logger.error(error);
            }

            if (this.httpServer) {
                this.httpServer.close(done);
            } else {
                done();
            }
        };

        try {
            await super.destroy();
            finish();
        } catch (e) {
            finish(e);
        }
    }

    async start() {
        if (!this.started) {
            logger.info('Starting services...');

            await super.start();

            logger.success('Initialized!');
            this.listen();
        }

        return true;
    }

    async boot() {
        if (this.booted) {
            return true;
        }
        
        this.emit('osjs/core:start');

        if (this.configuration.logging) {
            this.wss.on('connection', (c) => {
                logger.log('WebSocket connection opened');
                c.on('close', () => logger.log('WebSocket connection closed'));
            });

            if (this.configuration.morgan) {
                this.app.use(morgan(this.configuration.morgan));
            }
        }

        logger.info('Init Services...');
        await super.boot();
        this.emit('init');
        await this.start();
        this.emit('osjs/core:started');

        return true;
    }

    listen() {
        const httpPort = this.config('port');
        const wsPort = this.config('ws.port') || httpPort;
        const pub = this.config('public');
        const session = path.basename(path.dirname(this.config('session.store.module')));
        const dist = pub.replace(process.cwd(), '');
        const secure = this.config('https.enabled', false);
        const proto = prefix => `${prefix}${secure ? 's' : ''}://`;
        const host = port => `${this.config('hostname')}:${port}`;

        logger.info('Opening server connection');

        const checkFile = path.join(pub, this.configuration.index);
        if (!fs.existsSync(checkFile)) {
            logger.warn('Missing files in "dist/" directory. Did you forget to run "npm run build" ?');
        }

        this.httpServer.listen(httpPort, () => {
            logger.success(`Using '${session}' sessions`);
            logger.success(`Serving '${dist}'`);
            logger.success(`WebSocket listening on ${proto('ws')}${host(wsPort)}`);
            logger.success(`Server listening on ${proto('http')}${host(httpPort)}`);
        });
    }

    broadcast(name, params, filter) {
        filter = filter || (() => true);

        if (this.ws) {
            this.wss.clients //This is a Set
                .forEach(client => {
                    if (!client._osjs_client) {
                        return;
                    }

                    if (filter(client)) {
                        client.send(JSON.stringify({
                            params,
                            name
                        }));
                    }
                });
        }
    }

    broadcastAll(name, ...params) {
        return this.broadcast(name, params);
    }

    broadcastUser(username, name, ...params) {
        return this.broadcast(name, params, client => {
            return client._osjs_client.username === username;
        });
    }

    static getInstance() {
        return _instance;
    }
}

module.exports = Core;