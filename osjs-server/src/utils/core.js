const express_session = require('express-session');
const express_ws = require('express-ws');

/*
 * Converts an input argument to configuration entry
 * Overrides the user-created configuration file
 */
module.exports.argvToConfig = {
  'logging': logging => ({logging}),
  'development': development => ({development}),
  'port': port => ({port}),
  'ws-port': port => ({ws: {port}}),
  'secret': secret => ({session: {options: {secret}}}),
  'morgan': morgan => ({morgan}),
  'discovery': discovery => ({packages: {discovery}}),
  'manifest': manifest => ({packages: {manifest}})
};

/*
 * Create session parser
 */
module.exports.createSession = (app, configuration) => {
  const Store = require(configuration.session.store.module)(express_session);
  const store = new Store(configuration.session.store.options);

  return express_session({
    store,
    ...configuration.session.options
  });
};

/*
 * Create WebSocket server
 */
module.exports.createWebsocket = (app, configuration, session, httpServer) => express_ws(app, httpServer, {
  wsOptions: {
    ...configuration.ws,
    verifyClient: (info, done) => {
      session(info.req, {}, () => {
        done(true);
      });
    }
  }
});

/*
 * Wrapper for parsing json
 */
module.exports.parseJson = str => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
};

/*
 * Checks groups for a request
 */
const validateGroups = (req, groups, all) => {
  if (groups instanceof Array && groups.length) {
    const userGroups = req.session.user.groups;

    const method = all ? 'every' : 'some';

    return groups[method](g => userGroups.indexOf(g) !== -1);
  }

  return true;
};

/*
 * Authentication middleware wrapper
 */
module.exports.isAuthenticated = (groups = [], all = false) => (req, res, next) => {
  if (req.session.user && validateGroups(req, groups, all)) {
    return next();
  }

  return res
    .status(403)
    .send('Access denied');
};

/**
 * Closes an array of watches
 */
module.exports.closeWatches = (watches) => Promise.all(
  watches.map((w) => {
    return w.close()
      .catch(error => console.warn(error));
  })
);