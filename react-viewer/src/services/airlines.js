import {PromiseCache} from "./cache";

export class Airlines {
  constructor(cache) {
    this.cache = cache;
  }

  get() {
    return this.cache.poll({
      key: 'airlines',
      allocate: async () => {
        const resp = await fetch('/airlines.json', {
          headers: {
            Accept: 'application/json',
          },
        });

        if (resp.status !== 200) {
          const text = await resp.text();
          throw new Error(`unexpected response: ${resp.status}: ${text}`);
        }

        const table = await resp.json();
        const icao = {};

        for (let index = 0; index < table.length; ++index) {
          const entry = table[index];

          if (entry.icao) {
            icao[entry.icao] = index;
          }
        }

        return {
          table,
          icao,
        };
      },
    });
  }

  byCallsign(callsign) {
    const cached = this.get();
    if (cached === null) {
      return null;
    }

    let match = "";
    let airline = null;
    for (const entry of cached.table) {
      if (entry.icao && entry.icao.length > match.length && callsign.startsWith(entry.icao)) {
        match = entry.icao;
        airline = entry;
      }
    }

    return airline;
  }
}

Airlines.default = new Airlines(PromiseCache.default);
