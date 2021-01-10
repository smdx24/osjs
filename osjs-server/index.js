const Core = require('./src/core.js');
const Auth = require('./src/auth.js');
const Filesystem = require('./src/filesystem.js');
const Settings = require('./src/settings.js');
const Packages = require('./src/packages.js');
const CoreServiceProvider = require('./src/providers/core');
const PackageServiceProvider = require('./src/providers/packages');
const VFSServiceProvider = require('./src/providers/vfs');
const AuthServiceProvider = require('./src/providers/auth');
const SettingsServiceProvider = require('./src/providers/settings');

module.exports = {
    Core,
    Auth,
    Filesystem,
    Settings,
    Packages,
    CoreServiceProvider,
    PackageServiceProvider,
    VFSServiceProvider,
    AuthServiceProvider,
    SettingsServiceProvider
};