import {PromiseCache} from "./cache";

const MAX_SECTION_LEVEL = 8;

export class SectionSource {
  constructor(cache) {
    this.cache = cache;
  }

  number(v) {
    const digits = '000' + v.toFixed();
    return digits.substring(digits.length - 3);
  }

  key(level, x, y) {
    return `section_${this.number(level)}_${this.number(x)}_${this.number(y)}`;
  }

  get(level, x, y) {
    const levelToFetch = Math.min(level, MAX_SECTION_LEVEL);
    if (levelToFetch !== level) {
      x = x >> (level - levelToFetch);
      y = y >> (level - levelToFetch);
      level = levelToFetch;
    }

    const key = this.key(level, x, y);
    return this.cache.poll({
      key,
      ttl: 60_000,
      async allocate() {
        const path = `sections/${key}.json`;
        const resp = await fetch(path, {
          headers: {'Accept': 'application/json'},
        });

        if (resp.status === 404) {
          // Return an empty section for simplicity.
          return {
            shapes: [],
            labels: [],
            points: [],
            airports: [],
            runways: [],
            airspaces: [],
            airways: [],
          };
        }

        return await resp.json();
      },
    });
  }
}

SectionSource.default = new SectionSource(PromiseCache.default);
