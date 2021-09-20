
export class Cache {
  constructor(size) {
    this.ttl = 10_000;
    this.entries = {};
  }

  evict(key) {
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
    existing.timeout = setTimeout(Cache.prototype.evict.bind(this, key), this.ttl);
    return existing;
  }

  allocate(key, allocate, free) {
    const existing = this.entries[key];
    if (existing !== undefined) {
      return existing;
    }

    const entry = {
      key,
      value: allocate(),
      free,
      timeout: setTimeout(Cache.prototype.evict.bind(this, key), this.ttl),
    };
    this.entries[key] = entry;
    return entry;
  }
}
