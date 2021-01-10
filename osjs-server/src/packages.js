const fs = require('fs-extra');
const fg = require('fast-glob');
const path = require('path');
const Package = require('./package.js');
const consola = require('consola');
const logger = consola.withTag('Packages');

const relative = filename => filename.replace(process.cwd(), '');

const readOrDefault = filename => fs.existsSync(filename)
  ? fs.readJsonSync(filename)
  : [];

  class Packages {
      constructor(core, options = {}) {
          this.core = core;

          this.packages = [];
          this.hotReloading = {};
          this.options = {
              manifestFile: null,
              discoveredFile: null,
              ...options
          };
      }

      init() {
          this.core.on('osjs/application:socket:message', (ws, ...params) => {
              this.handleMessage(ws, params);
          });

          return this.load();
      }

      load() {
          return this.createLoader()
            .then(packages => {
                this.packages = this.packages.concat(packages);

                return true;
            });
      }

      createLoader() {
          let result = [];
          const {discoveredFile, manifestFile} = this.options;
          const discovered = readOrDefault(discoveredFile);
          const manifest = readOrDefault(manifestFile);
          const sources = discovered.map(d => path.join(d, 'metadata.json'));

          logger.info('Using package discovery file', relative(discoveredFile));
          logger.info('Using package manifest file', relative(manifestFile));

          const stream = fg.stream(sources, {
              extension: false,
              brace: false,
              deep: 1,
              case: false
          });

          stream.on('error', error => logger.error(error));
          stream.on('data', filename => {
              result.push(this.loadPackage(filename, manifest));
          });

          return new Promise((resolve, reject) => {
              stream.once('end', () => {
                  Promise.all(result)
                    .then(result => result.filter(iter => !!iter.handler))
                    .then(resolve)
                    .catch(reject);
              });
          });
      }

      onPackageChanged(pkg) {
          clearTimeout(this.hotReloading[pkg.metadata.name]);
          
          this.hotReloading[pkg.metadata.name] = setTimeout(() => {
              logger.debug('Sending reload signal for', pkg.metadata.name);
              this.core.broadcast('osjs/packages:package:changed', [pkg.metadata.name]);
          }, 500);
      }

      loadPackage(filename, manifest) {
          const done = (pkg, error) => {
              if (error) {
                  logger.warn(error);
              }

              return Promise.resolve(pkg);
          };

          return fs.readJson(filename)
            .than(metadata => {
                const pkg = new Package(this.core, {
                    filename,
                    metadata
                });

                return this.initializePackage(pkg, manifest, done);
            });
      }

      initializePackage(pkg, manifest, done) {
          if (pkg.validate(manifest)) {
              logger.info('Loading ${relative(pkg.script)}');

              try {
                  if (this.core.configuration.development) {
                      pkg.watch(() => {
                          this.onPackageChanged(pkg);
                      });
                  }

                  return pkg.init()
                    .then(() => done(pkg))
                    .catch(e => done(pkg, e));
              } catch (e) {
                  return done(pkg, e);
              }
          }

          return done(pkg);
      }

      start() {
          this.packages.forEach(pkg => pkg.start());
      }

      async destroy() {
          await Promise.all(this.packages.map(pkg => pkg.destroy()));
          this.packages = [];
      }

      handleMessage(ws, params) { 
          const {pid, name, args} = params[0];
          const found = this.packages.findIndex((metadata) => metadata.name === name);

          if (found !== -1) {
              const {handler} = this.packages[found];
              if (handler && typeof handler.onmessage === 'function') {
                  const respond = (...respondParams) => ws.send(JSON.stringify({
                      name: 'osjs/application:socket:message',
                      params: [{
                          pid,
                          args: respondParams
                      }]
                  }));

                  handler.onmessage(ws, respond, args);
              }
          }
      }
  }

  module.exports = Packages;