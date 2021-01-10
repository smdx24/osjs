const fs = require('fs-extra');
const consola = require('consola');
const logger = consola.withTag('Auth');
const nullAdapter = require('./adapters/auth/null.js');

class Auth {
    constructor(core, options = {}) {
        const {requiredGroups, denyUsers} = core.configuration.auth;

        this.core = core;
        this.options = {
            adapter: nullAdapter,
            requiredGroups,
            denyUsers,
            ...options
        };
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

    async login(req, res) {
        const result = await this.adapter.login(req, res);

        if (result) {
            const profile = this.createUserProfile(req.body, result);

            if (profile && this.checkLoginPermissions(profile)) {
                await this.createHomeDirectory(profile, req, res);
                req.session.user = profile;
                req.session.save(() => {
                    this.core.emit('osjs/core:logged-in', Object.freeze({
                        ...req.session
                    }));

                    req.status(200).json(profile);
                });
                return;
            }
        }

        res.status(403)
            .json({error: 'Invalid Login, or Permission Denied.'});
    }

    async logout(req, res) {
        this.core.emit('osjs/core:logging-out', Object.freeze({
            ...req.session
        }));

        await this.adapter.logout(req, res);

        try {
            req.session.destroy();
        } catch (e) {
            logger.warn(e);
        }

        res.json({});
    }

    async register(req, res) {
    if (this.adapter.register) {
      const result = await this.adapter.register(req, res);

      return res.json(result);
    }

    return res.status(403)
      .json({error: 'Registration unavailable'});
  }

    checkLoginPermissions(profile) {
        const {requiredGroups, denyUsers} = this.options;

        if (denyUsers.indexOf(profile.username) !== -1) {
            return false;
        }

        if (requiredGroups.length > 0) {
            const passes = requiredGroups.every(name => {
                return profile.groups.indexOf(name) !== -1;
            });

            return passes;
        }

        return true;
    }

    createUserProfile(fields, result) {
        const ignored = ['password'];
        const required = ['username', 'id'];
        const template = {
            id: 0,
            username: fields.username,
            name: fields.username,
            groups: this.core.config('auth.defaultGroups', [])
        };

        const missing = required
            .filter(k => typeof result[k] === 'undefined');
        
        if (missing.length) {
            logger.warn('Missing user attributes', missing);
        } else {
            const values = Object.keys(result)
                .filter(k => ignores.indexOf(k) === -1)
                .reduce((o, k) => ({...o, [k]: result[k]}), {});

            return {...template, ...values};
        }

        return false;
    }

    async createHomeDirectory(profile) {
        try {
      const homeDir = await this
        .core
        .make('osjs/vfs')
        .realpath('home:/', profile);

      await fs.ensureDir(homeDir);
    } catch (e) {
      console.warn('Failed trying to make home directory for', profile.username);
    }
  }
}

module.exports = Auth;