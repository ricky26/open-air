const DEBUG = false;

const debugLog = (...args) => DEBUG && console.log('cache', ...args);

export class Cache {
  constructor() {
    this.ttl = 10_000;
    this.entries = {};
  }

  evict(key) {
    debugLog('evict', key, Object.keys(this.entries).length);

    const entry = this.entries[key];
    if (entry !== undefined) {
      if (entry.free) {
        entry.free(entry.value);
      }
    }
    delete this.entries[key];
  }

  use(key) {
    const existing = this.entries[key];
    if (existing === undefined) {
      return null;
    }

    clearTimeout(existing.timeout);
    existing.timeout = setTimeout(Cache.prototype.evict.bind(this, key), existing.ttl);
    return existing.value;
  }

  allocate({key, ttl, allocate, free}) {
    const existing = this.entries[key];
    if (existing !== undefined) {
      return existing;
    }

    if (ttl === undefined) {
      ttl = this.ttl;
    }

    const value = allocate();
    const timeout = setTimeout(Cache.prototype.evict.bind(this, key), ttl);
    this.entries[key] = {
      key,
      free,
      ttl,
      value,
      timeout,
    };
    return value;
  }

  pull(args) {
    const {key} = args;
    const existing = this.use(key);
    if (existing !== null) {
      return existing;
    }

    return this.allocate(args);
  }
}

Cache.default = new Cache();

export class PromiseCache {
  constructor(cache) {
    this.cache = cache;
  }

  allocate(args) {
    const allocate = () => {
      const cell = {
        loading: true,
        value: null,
        error: null,
      };
      cell.promise = args.allocate().then(
        value => {
          cell.error = null;
          cell.value = value;
          cell.loading = false;
        },
        err => {
          cell.error = err;
          cell.value = null;
          cell.loading = false;
        });
      return cell;
    };
    const free = cell => {
      args.free && cell.promise.finally(args.free);
    };

    return this.cache.pull({
      ...args,
      allocate,
      free,
    })
  }

  poll(args) {
    const cell = this.allocate(args);
    if (cell === null || cell.loading) {
      return null;
    }

    if (cell.error) {
      throw cell.error;
    }

    return cell.value;
  }
}

PromiseCache.default = new PromiseCache(Cache.default);
