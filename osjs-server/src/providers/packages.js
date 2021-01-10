const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const {ServiceProvider} = require('@osjs/common');
const Packages = require('../packages');
const {closeWatches} = require('../utils/core');

/**
 * OS.js Package Service Provider
 */
class PackageServiceProvider extends ServiceProvider {
  constructor(core) {
    super(core);

    const {configuration} = this.core;
    const manifestFile = path.join(configuration.public, configuration.packages.metadata);
    const discoveredFile = path.resolve(configuration.root, configuration.packages.discovery);

    this.watches = [];
    this.packages = new Packages(core, {
      manifestFile,
      discoveredFile
    });
  }

  provides() {
    return [
      'osjs/packages'
    ];
  }

  init() {
    this.core.singleton('osjs/packages', () => this.packages);

    return this.packages.init();
  }

  start() {
    this.packages.start();

    if (this.core.configuration.development) {
      this.initDeveloperTools();
    }
  }

  async destroy() {
    await closeWatches(this.watches);
    await this.packages.destroy();
    super.destroy();
  }

  /**
   * Initializes some developer features
   */
  initDeveloperTools() {
    const {manifestFile} = this.packages.options;

    if (fs.existsSync(manifestFile)) {
      const watcher = chokidar.watch(manifestFile);
      watcher.on('change', () => {
        this.core.broadcast('osjs/packages:metadata:changed');
      });
      this.watches.push(watcher);
    }
  }
}

module.exports = PackageServiceProvider;