module.exports = (function () {

  'use strict';

  /**  Delete cache entries
   *
   *  @method ExpressRedisCache.del
   *  @description Delete entry by name
   *  @return null
   *  @arg {String} name - The entry name
   *  @arg {Function} callback
   *  @arg {Any} ignore - Entry name to ignore (optional)
   */

  function del (name, callback, ignore) {
    var self = this;

    if ( typeof name !== 'string' ) {
      return this.emit('error', new Error('ExpressRedisCache.del: missing first argument String'));
    }

    if ( typeof callback !== 'function' ) {
      return this.emit('error', new Error('ExpressRedisCache.del: missing second argument Function'));
    }

    if ( typeof ignore !== 'string' && !Array.isArray(ignore)) {
      ignore = null;
    }
    
    var domain = require('domain').create();
    
    domain.on('error', function onDelError (error) {
      callback(error);
    });
    
    domain.run(function delRun () {
      
      /** Get prefix */
      
      var prefix = self.prefix.match(/:$/) ? self.prefix.replace(/:$/, '')
      : self.prefix;
      
      /** Tell Redis to delete hash */
      
      var redisKey = prefix + ':' + name;
      
      /** Tell Redis what keys to ignore */
      
      var ignoreKey = ignore;

      if ( typeof ignoreKey === 'string') {
        ignoreKey = prefix + ':' + ignoreKey;
      }
      if ( Array.isArray(ignoreKey)) {
        ignoreKey = ignoreKey.map(ign => prefix + ':' + ign);
      }
      
      /** Detect wilcard syntax */
      
      var hasWildcard = redisKey.indexOf('*') >= 0;
      
      const isIgnored = (toIgnore) => {
        if( typeof ignoreKey === 'string' ) {
          return toIgnore.indexOf(ignoreKey) === -1
        }
        if( Array.isArray(ignoreKey) ) {
          let isIgnoredInArray = true;
          ignoreKey.forEach((ig) => {
            if(toIgnore.indexOf(ig) !== -1) {
              isIgnoredInArray = false;
            }
          });
          return isIgnoredInArray;
        }
        return true;
      }

      const verifyName = (name) => {
        if( typeof ignoreKey === 'string' ) {
          return ignore.indexOf(name.replace('*', '')) !== -1 
        }
        if( Array.isArray(ignoreKey) ) {
          let verified = false;
          ignoreKey.forEach((ig) => {
            if(ig.indexOf(name.replace('*', '')) !== -1) {
              verified = true;
            }
          });
          return verified;
        }
        return true;
      }
      /** If has wildcard */
      
      if ( hasWildcard ) {
        
        /** Get a list of keys using the wildcard */
        
        self.client.keys(redisKey, domain.intercept(function onKeys (keys) {
          var deletedKeys = 0;
          require('async').each(keys,
            
            function onEachKey (key, callback) {
              if (
                !ignore ||
                isIgnored(key) &&
                (verifyName(name) || name === '*')
              ) {
                self.client.del(key,  domain.intercept(function () {
                  self.emit('message', require('util').format('DEL %s', key));
                  deletedKeys++;
                  callback();
                }));
              }
              else {
                callback();
              }
            },

            function onEachKeyDone (error) {

              if ( error ) {
                throw error;
              }

              callback(null, deletedKeys);

            });

        }));

      }

      /** No wildcard **/

      else {
        self.client.del(redisKey,
          domain.intercept(function onKeyDeleted (deletions) {
            self.emit('message', require('util').format('DEL %s', redisKey));
            callback(null, +deletions);
          }));
      }

    });
  }

  return del;

})();