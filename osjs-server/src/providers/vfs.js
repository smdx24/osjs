const {ServiceProvider} = require('@osjs/common');
const Filesystem = require('../filesystem');

/**
 * OS.js Virtual Filesystem Service Provider
 */
class VFSServiceProvider extends ServiceProvider {

  constructor(core, options = {}) {
    super(core, options);

    this.filesystem = new Filesystem(core, options);
  }

  async destroy() {
    await this.filesystem.destroy();
    super.destroy();
  }

  depends() {
    return [
      'osjs/express'
    ];
  }

  provides() {
    return [
      'osjs/fs',
      'osjs/vfs'
    ];
  }

  async init() {
    const filesystem = this.filesystem;

    await filesystem.init();

    this.core.singleton('osjs/fs', () => this.filesystem);

    this.core.singleton('osjs/vfs', () => ({
      realpath: (...args) => this.filesystem.realpath(...args),
      request: (...args) => this.filesystem.request(...args),
      call: (...args) => this.filesystem.call(...args),
      mime: (...args) => this.filesystem.mime(...args),

      get adapters() {
        return filesystem.adapters;
      },

      get mountpoints() {
        return filesystem.mountpoints;
      }
    }));

    this.core.app.use('/vfs', filesystem.router);
  }
}

module.exports = VFSServiceProvider;