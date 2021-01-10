const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const {Stream} = require('stream');
const {
    mountpointResolver,
    checkMountpointPermission,
    streamFromRequest,
    sanitize,
    parseFields,
    errorCodes
} = require('./utils/vfs');

const respondNumber = result => typeof result === 'number' ? result : -1;
const respondBoolean = result =>  typeof result === 'boolean' ? result : !!result;
const requestPath = req => ([sanitize(req.fields.path)]);
const searchRequest = req => ([sanitize(req.fields.root), req.fields.pattern]);
const requestCross = req => ([sanitize(req.fields.from), sanitize(req.fields.to)]);
const requestFile = req => ([sanitize(req.fields.path), streamFromRequest(req)]);

const parseRangeHeader = (range, size) => {
    const [pstart, pend] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(pstart, 10);
    const end = pend ? parseInt(pend, 10) : undefined;
    return [start, end];
};

const onDone = (req, res) => {
    if (req,files) {
        for (let fieldname in req.files) {
            fs.unlink(req.files[fieldname].path, () => ({}));
        }
    }
};

const wrapper = fn => (req, res, next) => fn(req, res)
    .then(result => {
        if (result instanceof Stream) {
            result.pipe(res);
        } else {
            res.json(result);
        }

        onDone(req, res);
    })
    .catch(error => {
        onDone(req, res);

        next(error);
    });

    const createMiddleware = core => {
        const parse = parseFields(core.config('express'));

        return (req, res, next) => parse(req, res)
            .then(({fields, files}) => {
                req.fields = fields;
                req.files = files;

                next();
            })
            .catch(error => {
                core.logger.warn(error);
                req.fields = {};
                req.files = {};

                next(error);
            });
    };

    const createOptions = req => {
        const options = req.fields.options;
        const range = req.headers && req.headers.range;
        const session = {...req.session || {}};
        let result = options || {};

        if (typeof options === 'string') {
            try {
                result = JSON.parse(req.fields.options || {});
            } catch (e) {
                //Allow to fall through.
            }
        }

        if (range) {
            result.range = parseRangeHeader(req.headers.range);
        }

        return {
            ...result,
            session
        };
    };

    const createRequestFactory = findMountpoint => (getter, method, readOnly, respond) => async (req, res) => {
        const options = createOptions(req);
        const args = [...getter(req, res), options];

        const found = await findMountpoint(args[0]);
        if (method === 'search') {
            if (found.mount.attributes && found.mount.attributes.searchable === false) {
                return [];
            }
        }

        const {attributes} = found.mount;
        const strict = attributes.strictGroups !== false;
        const ranges = (!attributes.adapter || attributes.adapter === 'system') || attributes.ranges === true;
        const vfsMethodWrapper = m => found.adapter[m]
            ? found.adapter[m](found)(...args)
            : Promise.reject(new Error('Adapter does not support ${m}'));
        const readstat = () => vfsMethodWrapper('stat').catch(() => ({}));
        await checkMountpointPermission(req, res, method, readOnly, strict)(found);

        const result = await vfsMethodWrapper(method);
        if (method === 'readfile') {
            const stat = await readstat();

            if (ranges && options.range) {
                try {
                    if (stat.size) {
                        const size = stat.size;
                        const [start, end] = options.range;
                        const realEnd = end ? end : size - 1;
                        const chunkSize = (realEnd - start) + 1;

                        res.writeHead(206, {
                            'Content-Range': `bytes ${start}-${realEnd}/${size}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': chunksize,
                            'Content-Type': stat.mime
                        });
                    }
                } catch (e) {
                    console.warn('Failed to send a ranged response.', e);
                }
            } else if (stat.mime) {
                res.append('Content-Type', stat.mime);
            }

            if (options.download) {
                const filename = path.basename(args[0]);
                res.append('Conent-Disposition', 'attachment; filename=${filename}');
            }
        }

        return respond ? respond(result) : result;
    };

    const createCrossRequestFactory = findMountpoint => (getter, method, respond) => async (req, res) => {
        const [from, to, options] = [...getter(req, res), createOptions(req)];

        const srcMount = await findMountpoint(from);
        const destMount = await findMountpoint(to);
        const sameAdapter = srcMount.adapter === destMount.adapter;

        const srcStrict = srcMount.mount.attributes.strictGroups !== false;
        const desStrict = destMount.mount.attributes.strictGroups !== false;
        await checkMountpointPermission(req, res, 'readfile', false, srcStrict)(srcMount);
        await checkMountpointPermission(req, res, 'writefile', true, destStrict)(destMount);

        if (sameAdapter) {
            const result = await srcMount
                .adapter[method](srcMount, destMount)(from, to, options);

            return !!result;
        }

        const stream = await srcMount.adapter
            .readfile(srcMount)(from, options);
        
        const result = await destMount.adapter
            .writefile(destMount)(to, stream, options);

        if (method === 'rename') {
            await srcMount.adapter
                .unlink(srcMount)(from, options);
        }

        return !!result;
    };

    const vfs = core => {
        const findMountpoint = mountpointResolver(core);
        const createRequest = createRequestFactory(findMountpoint);
        const createCrossRequest = createCrossRequestFactory(findMountpoint);

        return {
            realpath: createRequest(requestPath, 'realpath', false),
            exists: createRequest(requestPath, 'exists', false, respondBoolean),
            stat: createRequest(requestPath, 'stat', false),
            readdir: createRequest(requestPath, 'readdir', false),
            readfile: createRequest(requestPath, 'readfile', false),
            writefile: createRequest(requestPath, 'writefile', true, respondNumber),
            mkdir: createRequest(requestPath, 'mkdir', true, respondBoolean),
            unlink: createRequest(requestPath, 'unlink', true, respondBoolean),
            touch: createRequest(requestPath, 'touch', true, respondBoolean),
            search: createRequest(requestPath, 'search', false),
            copy: createRequest(requestPath, 'copy'),
            rename: createRequest(requestPath, 'rename')
        };
    };

    module.exports = core => {
        const router = express.Router();
        const methods = vfs(core);
        const middleware = createMiddleware(core);
        const {isAuthenticated} = core.make('osjs/express');
        const vfsGroups = core.config('auth.vfsGroups', []);
        const logEnabled = core.config('development');

        //Middleware first
        router.use(isAuthenticated(vfsGroups));
        router.use(middleware);

        //Than all VFS Routes.
        router.get('/exists', wrapper(methods.exists));
        router.get('/stat', wrapper(methods.exists));
        router.get('/readdir', wrapper(methods.exists));
        router.get('/readfile', wrapper(methods.exists));
        router.post('/writefile', wrapper(methods.exists));
        router.post('/rename', wrapper(methods.exists));
        router.post('/copy', wrapper(methods.exists));
        router.post('/mkdir', wrapper(methods.exists));
        router.post('/unlink', wrapper(methods.exists));
        router.post('/touch', wrapper(methods.exists));
        router.post('/search', wrapper(methods.exists));

        //Finally catch any promise exceptions.
        router.use((error, req, res, next) => {
            const code = typeof error.code === 'number'
                ? error.code
                : (errorCodes[error.code] || 400);
                
            if (logEnabled) {
                console.error(error);
            }

            res.status(code)
                .json({
                    error: error.toString(),
                    stack: logEnabled ? error.stack : undefined
                });
        });

        return {router, methods};
    };