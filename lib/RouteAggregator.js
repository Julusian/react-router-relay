'use strict';

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _WeakMap = require('babel-runtime/core-js/weak-map')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _Object$assign = require('babel-runtime/core-js/object/assign')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

exports.__esModule = true;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _reactRelay = require('react-relay');

var _reactRelay2 = _interopRequireDefault(_reactRelay);

var _getParamsForRoute = require('./getParamsForRoute');

var _getParamsForRoute2 = _interopRequireDefault(_getParamsForRoute);

var RouteAggregator = (function () {
  function RouteAggregator() {
    _classCallCheck(this, RouteAggregator);

    // We need to use a map to track route indices instead of throwing them on
    // the route itself with a Symbol to ensure that, when rendering on the
    // server, each request generates route indices independently.
    this._routeIndices = new _WeakMap();
    this._lastRouteIndex = 0;

    this.route = null;
    this._fragmentSpecs = null;

    this._failure = null;
    this._data = {};
    this._readyState = null;
  }

  RouteAggregator.prototype.updateRoute = function updateRoute(_ref4) {
    var _this2 = this;

    var routes = _ref4.routes;
    var components = _ref4.components;
    var params = _ref4.params;
    var location = _ref4.location;

    var relayRoute = {
      name: null,
      queries: {},
      params: {}
    };
    var fragmentSpecs = {};

    routes.forEach(function (route, i) {
      var queries = route.queries;

      if (!queries) {
        return;
      }

      var component = components[i];

      // In principle not all container component routes have to specify
      // queries, because some of them might somehow receive fragments from
      // their parents, but it would definitely be wrong to specify queries
      // for a component that isn't a container.

      if (typeof component != "object") {
        component = { "default": component };
        queries = { "default": queries };
      }

      _Object$keys(component).forEach((function (c) {
        var _this = this;

        var comp = component[c];
        var myQ = queries[c];

        if (!myQ) {
          return;
        }

        !_reactRelay2['default'].isContainer(comp) ? process.env.NODE_ENV !== 'production' ? _invariant2['default'](false, 'relay-nested-routes: Route with queries specifies component `%s` ' + 'that is not a Relay container.', comp.displayName || comp.name) : _invariant2['default'](false) : undefined;

        var routeParams = _getParamsForRoute2['default']({ route: route, routes: routes, params: params, location: location });
        _Object$assign(relayRoute.params, routeParams);

        _Object$keys(myQ).forEach(function (queryName) {
          var query = myQ[queryName];
          var uniqueQueryName = _this._getUniqueQueryName(route, c, queryName);

          // Relay depends on the argument count of the query function, so try to
          // preserve it as well as possible.
          var wrappedQuery = undefined;
          if (query.length === 0) {
            // Relay doesn't like using the exact same query in multiple places,
            // so wrap it to prevent that when sharing queries between routes.
            wrappedQuery = function () {
              return query();
            };
          } else {
            // We just need the query function to have > 0 arguments.
            /* eslint-disable no-unused-vars */
            wrappedQuery = function (_) {
              return query(comp, routeParams);
            };
            /* eslint-enable */
          }

          relayRoute.queries[uniqueQueryName] = wrappedQuery;
          fragmentSpecs[uniqueQueryName] = { component: comp, queryName: queryName };
        });
      }).bind(_this2));
    });

    relayRoute.name = ['$$_aggregated'].concat(_Object$keys(relayRoute.queries)).join('-');

    // RootContainer uses referential equality to check for route change, so
    // replace the route object entirely.
    this.route = relayRoute;
    this._fragmentSpecs = fragmentSpecs;
  };

  RouteAggregator.prototype._getUniqueQueryName = function _getUniqueQueryName(route, compKey, queryName) {
    // There might be some edge case here where the query changes but the route
    // object does not, in which case we'll keep using the old unique name.
    // Anybody who does that deserves whatever they get, though.

    // Prefer an explicit route name if specified.
    if (route.name) {
      // The slightly different template here ensures that we can't have
      // collisions with the below template.
      return '$_' + route.name + '_' + compKey + '_' + queryName;
    }

    // Otherwise, use referential equality on the route name to generate a
    // unique index.
    var routeIndex = this._routeIndices.get(route);
    if (routeIndex === undefined) {
      routeIndex = ++this._lastRouteIndex;
      this._routeIndices.set(route, routeIndex);
    }

    return '$$_route[' + routeIndex + ']_' + compKey + '_' + queryName;
  };

  RouteAggregator.prototype.setFailure = function setFailure(error, retry) {
    this._failure = [error, retry];
  };

  RouteAggregator.prototype.setFetched = function setFetched(data, readyState) {
    this._failure = null;
    this._data = data;
    this._readyState = readyState;
  };

  RouteAggregator.prototype.setLoading = function setLoading() {
    this._failure = null;
  };

  RouteAggregator.prototype.getData = function getData(route, queries, params) {
    // Check that the subset of parameters used for this route match those used
    // for the fetched data.
    for (var _iterator = _Object$keys(params), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _getIterator(_iterator);;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      var paramName = _ref;

      if (this._data[paramName] !== params[paramName]) {
        return this._getDataNotFound();
      }
    }

    var fragmentPointers = {};

    var mangledQueries = typeof route.components == "object" ? queries : { "default": queries };
    for (var _iterator2 = _Object$keys(mangledQueries), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _getIterator(_iterator2);;) {
      var _ref2;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref2 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref2 = _i2.value;
      }

      var compKey = _ref2;

      for (var _iterator3 = _Object$keys(queries[compKey]), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _getIterator(_iterator3);;) {
        var _ref3;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref3 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref3 = _i3.value;
        }

        var queryName = _ref3;

        var uniqueQueryName = this._getUniqueQueryName(route, compKey, queryName);

        var fragmentPointer = this._data[uniqueQueryName];
        if (!fragmentPointer) {
          return this._getDataNotFound();
        }

        fragmentPointers[queryName] = fragmentPointer;
      }
    }

    return {
      fragmentPointers: fragmentPointers,
      readyState: this._readyState
    };
  };

  RouteAggregator.prototype._getDataNotFound = function _getDataNotFound() {
    return { failure: this._failure };
  };

  RouteAggregator.prototype.getFragmentNames = function getFragmentNames() {
    return _Object$keys(this._fragmentSpecs);
  };

  RouteAggregator.prototype.getFragment = function getFragment(fragmentName, variableMapping) {
    var _fragmentSpecs$fragmentName = this._fragmentSpecs[fragmentName];
    var component = _fragmentSpecs$fragmentName.component;
    var queryName = _fragmentSpecs$fragmentName.queryName;

    return component.getFragment(queryName, variableMapping);
  };

  RouteAggregator.prototype.hasFragment = function hasFragment(fragmentName) {
    return this._fragmentSpecs[fragmentName] !== undefined;
  };

  RouteAggregator.prototype.hasVariable = function hasVariable(variableName) {
    // It doesn't matter what the component variables are. The only variables
    // we're going to pass down are the ones defined from our route parameters.
    return this.route.params.hasOwnProperty(variableName);
  };

  return RouteAggregator;
})();

exports['default'] = RouteAggregator;
module.exports = exports['default'];