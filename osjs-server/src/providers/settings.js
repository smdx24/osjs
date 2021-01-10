const Settings = require('../settings');
const {ServiceProvider} = require('@osjs/common');

/**
 * OS.js Settings Service Provider
 */
class SettingsServiceProvider extends ServiceProvider {

  constructor(core, options) {
    super(core, options);

    this.settings = new Settings(core, options);
  }

  destroy() {
    super.destroy();
    this.settings.destroy();
  }

  async init() {
    this.core.make('osjs/express')
      .routeAuthenticated('post', '/settings', (req, res) => this.settings.save(req, res));

    this.core.make('osjs/express')
      .routeAuthenticated('get', '/settings', (req, res) => this.settings.load(req, res));

    return this.settings.init();
  }
}

module.exports = SettingsServiceProvider;