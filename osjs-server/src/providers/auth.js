const {ServiceProvider} = require('@osjs/common');
const Auth = require('../auth.js');

class AuthServiceProvider extends ServiceProvider {
    constructor(core, options) {
        super(core, options);

        this.auth = new Auth(core, options);
    }

    destroy() {
        this.auth.destroy();
        super.destroy();
    }

    async init() {
        const {route, routeAuthenticated} = this.core.make('osjs/express');

        route('post', '/register', (req, res) => this.auth.register(req, res));
        route('post', '/login', (req, res) => this.auth.login(req, res));
        routeAuthenticated('post', '/logout', (req, res) => this.auth.logout(req, res));

        await this.auth.init();
    }
}

module.exports = AuthServiceProvider;