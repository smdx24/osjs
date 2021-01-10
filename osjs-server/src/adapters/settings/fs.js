const fs = require('fs-extra');
const path = require('path');

/**
 * FS Settings adapter
 * @param {Core} core Core reference
 * @param {object} [options] Adapter options
 */
module.exports = (core, options) => {
  const fsOptions = {
    system: false,
    path: 'home:/.osjs/settings.json',
    ...options || {}
  };

  const getRealFilename = (req) => fsOptions.system
    ? Promise.resolve(fsOptions.path)
    : core.make('osjs/vfs')
      .realpath(fsOptions.path, req.session.user);

  const before = req => getRealFilename(req)
    .then(filename => fs.ensureDir(path.dirname(filename))
      .then(() => filename));

  const save = req => before(req)
    .then(filename => fs.writeJson(filename, req.body))
    .then(() => true);

  const load = req => before(req)
    .then(filename => fs.readJson(filename))
    .catch(error => {
      core.logger.warn(error);
      return {};
    });

  return {save, load};
};