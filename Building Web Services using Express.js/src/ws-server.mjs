import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';

import ModelError from './model-error.mjs';

//not all codes necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

const BASE = 'api';

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  app.use(cors());

  //pseudo-handlers used to set up defaults for req
  app.use(bodyParser.json());      //always parse request bodies as JSON
  app.use(reqSelfUrl, reqBaseUrl); //set useful properties in req

  //application routes
  app.get(`/${BASE}`, doBase(app));
  //@TODO: add other application routes
  app.post(`/${BASE}/carts`, doCreate(app));
  app.patch(`/${BASE}/carts/:id`, doUpdate(app));
  app.get(`/${BASE}/carts/:id`, doGetCart(app));
  app.get(`/${BASE}/books/:isbn`, doGetBook(app));
  app.get(`/${BASE}/books`, doGetBooks(app));
  //must be last
  app.use(do404(app));
  app.use(doErrors(app));
}

/****************************** Handlers *******************************/

/** Sets selfUrl property on req to complete URL of req,
 *  including query parameters.
 */
function reqSelfUrl(req, res, next) {
  const port = req.app.locals.port;
  req.selfUrl = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
  next();  //absolutely essential
}

/** Sets baseUrl property on req to complete URL of BASE. */
function reqBaseUrl(req, res, next) {
  const port = req.app.locals.port;
  req.baseUrl = `${req.protocol}://${req.hostname}:${port}/${BASE}`;
  next(); //absolutely essential
}

function doBase(app) {
  return function(req, res) {
    try {
      const links = [
        { rel: 'self', name: 'self', href: req.selfUrl, },
        //@TODO add links for book and cart collections
        { rel: 'collection', name: 'books', href: `${req.selfUrl}/books`, },
        { rel: 'collection', name: 'carts', href: `${req.selfUrl}/carts`, },
      ];
      res.json({ links });
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

//@TODO: Add handlers for other application routes

function doCreate(app) {
  return errorWrap(async function(req, res) {
    try {
      const obj = req.body;
      const results = await app.locals.model.newCart(obj);
      res.append('Location', requestUrl(req) + '/' + results);
      res.sendStatus(CREATED);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doUpdate(app) {
  return errorWrap(async function(req, res) {
    try {
      const patch = Object.assign({}, req.body);
      patch.cartId = req.params.id;
      await app.locals.model.cartItem(patch);
      res.sendStatus(NO_CONTENT);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGetBook(app) {
  return errorWrap(async function(req, res) {
    try {
      const isbn = req.params.isbn;
      const result = await app.locals.model.findBooks({ isbn: isbn });
      if (result.length === 0) {

        throw [ new ModelError('BAD_ID', `no book for isbn ${isbn}`, 'isbn'), ];
      } else {
        assert(Number.parseInt(result.length) < 2)
        const links = [{ rel: 'self', name: 'self', href: `${req.selfUrl}`, }];
        res.json({links,result});
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGetCart(app) {
  return errorWrap(async function(req, res) {
    try {

      const id = req.params.id;
      const result = await app.locals.model.getCart({ cartId: id });
      const _lastModified = result['_lastModified'];
      const results = [];
      for (const r of Object.keys(result)){
        if (r !== '_lastModified'){
          let sku = r;
          let links = [{href: `${req.baseUrl}/books/` + sku, name: 'book', rel: 'item'}];
          results.push({links,sku: sku, nUnits: result[r]})
        }
      }
      if (result.length === 0) {
        throw [ new ModelError('BAD_ID', msg, 'cartId')];
      }
      else {
        const links = [{ rel: 'self', name: 'self', href: `${req.selfUrl}`, }];
        res.json({_lastModified,links,results});
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGetBooks(app) {
  return errorWrap(async function(req, res) {
    const q = req.query || {};
    try {
      const results = await app.locals.model.findBooks(q);
      const resultsActualSize = await app.locals.model.findBooks({'authorsTitleSearch': q['authorsTitleSearch'], '_count': 100});
      const result = [];
      for (const r of results){
        let links = [{href: `${req.baseUrl}/books/` + r['isbn'], name: 'book', rel: 'details'}]
        result.push({
          links,
          '_lastModified': r['_lastModified'],
          'title': r['title'],
          'isbn': r['isbn'],
          'year': r['year'],
          'publisher': r['publisher'],
          'authors': r['authors'],
          'pages': r['pages'],
        })
      }

      const links = [{href: `${req.selfUrl}`, name: 'self', rel: 'self'}]
      const index = q['_index'];
      if (Number.parseInt(resultsActualSize.length) > 5 && index === undefined){
        links.push({href: `${req.baseUrl}/books?authorsTitleSearch=` + q['authorsTitleSearch'] + `&_index=5` + (q['_count'] === undefined? '' : `&_count=` + q['_count']), name: 'next', rel: 'next'})
      }else if (Number.parseInt(resultsActualSize.length) > 5 && Number.parseInt(index) >= 5){
        links.push({href: `${req.baseUrl}/books?authorsTitleSearch=` + q['authorsTitleSearch'] + `&_index=` + (Number.parseInt(index) - 5) + (q['_count'] === undefined? '' : `&_count=` + q['_count']), name: 'prev', rel: 'prev'})
      }else if (Number.parseInt(resultsActualSize.length) - 1 === Number.parseInt(index)){
        links.push({href: `${req.baseUrl}/books?authorsTitleSearch=` + q['authorsTitleSearch'] + `&_index=` + (Number.parseInt(resultsActualSize.length) - 2) + `&_count=` + q['_count'], name: 'prev', rel: 'prev'})
      } else if (Number.parseInt(resultsActualSize.length) - 1 > Number.parseInt(index)){
        links.push({href: `${req.baseUrl}/books?authorsTitleSearch=` + q['authorsTitleSearch'] + `&_index=` + (Number.parseInt(index) - 1) + `&_count=` + q['_count'], name: 'prev', rel: 'prev'})
        links.push({href: `${req.baseUrl}/books?authorsTitleSearch=` + q['authorsTitleSearch'] + `&_index=` + (Number.parseInt(index) + 1) + `&_count=` + q['_count'], name: 'next', rel: 'next'})
      }
      res.json({links, result});
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

/** Set up error handling for handler by wrapping it in a
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: NOT_FOUND,
      errors: [	{ code: 'NOT_FOUND', message, }, ],
    };
    res.type('text').
    status(404).
    json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */
function doErrors(app) {
  return async function(err, req, res, next) {
    const result = {
      status: SERVER_ERROR,
      errors: [ { code: 'SERVER_ERROR', message: err.message } ],
    };
    res.status(SERVER_ERROR).json(result);
    console.error(err);
  };
}


/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  BAD_ID: NOT_FOUND,
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code and an errors property containing list of error objects
 *  with code, message and name properties.
 */
function mapError(err) {
  const isDomainError =
      (err instanceof Array && err.length > 0 && err[0] instanceof ModelError);
  const status =
      isDomainError ? (ERROR_MAP[err[0].code] || BAD_REQUEST) : SERVER_ERROR;
  const errors =
      isDomainError
          ? err.map(e => ({ code: e.code, message: e.message, name: e.name }))
          : [ { code: 'SERVER_ERROR', message: err.toString(), } ];
  if (!isDomainError) console.error(err);
  return { status, errors };
}

/****************************** Utilities ******************************/

/** Return original URL for req */
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}
