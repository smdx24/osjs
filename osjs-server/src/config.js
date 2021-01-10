const path = require('path');
const maxAge = 60 * 60 * 12;
const mb = m => m * 1024 * 1024;

const defaultConfiguration = {
  development: !(process.env.NODE_ENV || '').match(/^prod/i),
  logging: true,
  index: 'index.html',
  hostname: 'localhost',
  port: 8000,
  public: null,
  morgan: 'tiny',
  express: {
    maxFieldsSize: mb(20),
    maxFileSize: mb(200)
  },
  https: {
    enabled: false,
    options: {
      key: null,
      cert: null
    }
  },
  ws: {
    port: null,
    ping: 30 * 1000
  },
  proxy: [
    /*
    {
      source: 'pattern',
      destination: 'pattern',
      options: {}
    }
    */
  ],
  auth: {
    vfsGroups: [],
    defaultGroups: [],
    requiredGroups: [],
    requireAllGroups: false,
    denyUsers: []
  },
  mime: {
    filenames: {
      // 'filename': 'mime/type'
      'Makefile': 'text/x-makefile',
      '.gitignore': 'text/plain'
    },
    define: {
      // 'mime/type': ['ext']
      'text/x-lilypond': ['ly', 'ily'],
      'text/x-python': ['py'],
      'application/tar+gzip': ['tgz']
    }
  },
  session: {
    store: {
      module: require.resolve('connect-loki'),
      options: {
        autosave: true
        //ttl: maxAge
      }
    },
    options: {
      name: 'osjs.sid',
      secret: 'osjs',
      rolling: true,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        maxAge: 1000 * maxAge
      }
    }
  },
  packages: {
    // Resolves to root by default
    discovery: 'packages.json',

    // Resolves to dist/ by default
    metadata: 'metadata.json'
  },

  vfs: {
    watch: false,
    root: path.join(process.cwd(), 'vfs'),

    mountpoints: [{
      name: 'osjs',
      attributes: {
        root: '{root}/dist',
        readOnly: true
      }
    }, {
      name: 'home',
      attributes: {
        root: '{vfs}/{username}'
      }
    }]
  }
};

module.exports = {
  defaultConfiguration
};