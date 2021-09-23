import {geo2map} from "./coords";
import {sleep} from "./promise";

const WHAZZUP_V2_ENDPOINT = 'https://api.ivao.aero/v2/tracker/whazzup';

export class Whazzup {
  constructor() {
    this.v2 = {
      pilots: [],
    };
    this.pilots = {};

    // Kick off workers.
    this._fetchV2();
  }

  async _fetchV2() {
    for (;;) {
      try {
        const resp = await fetch(WHAZZUP_V2_ENDPOINT, {
          headers: {Accept: 'application/json'},
        });

        if (resp.status !== 200) {
          const text = await resp.text();
          throw new Error(`failed to fetch whazzup: ${resp.status}: ${text}`);
        }

        const json = await resp.json();
        this.v2 = json;

        const clients = json.clients || [];

        const pilots = {};
        for (const pilot of (clients.pilots || [])) {
          pilots[pilot.callsign] = pilot;

          if (pilot.lastTrack) {
            const {latitude, longitude} = pilot.lastTrack;
            const [mapX, mapY] = geo2map(latitude, longitude);
            pilot.lastTrack.mapX = mapX;
            pilot.lastTrack.mapY = mapY;
          }
        }
        this.pilots = pilots;
      } catch (err) {
        console.error('failed to fetch whazzup v2', err)
      }

      await sleep(5000);
    }
  }
}

Whazzup.default = new Whazzup();
