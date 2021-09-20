use anyhow::anyhow;

use crate::aurora::gdf::Statement;

pub struct Airport {
    pub identifier: String,
    pub elevation: f64,
    pub transition_altitude: Option<f64>,
    pub geo_position: (String, String),
    pub name: String,
    pub hide_tag: bool,
}

impl Airport {
    pub fn parse(statement: &Statement) -> anyhow::Result<Airport> {
        let mut parts = statement.parts();

        let identifier = parts.next()
            .ok_or_else(|| anyhow!("missing identifier"))?
            .to_owned();
        let elevation = parts.next()
            .ok_or_else(|| anyhow!("missing elevation"))?
            .parse::<f64>()?;
        let transition_altitude = parts.next()
            .and_then(|v| if v == "" { None } else { Some(v) })
            .map(|v| v.parse::<f64>())
            .transpose()?;
        let lat = parts.next()
            .ok_or_else(|| anyhow!("missing latitude"))?
            .to_owned();
        let long = parts.next()
            .ok_or_else(|| anyhow!("missing longitude"))?
            .to_owned();
        let name = parts.next()
            .ok_or_else(|| anyhow!("missing airfield name"))?
            .to_owned();
        let hide_tag = parts.next().map_or(false, |v| v == "1");

        Ok(Airport {
            identifier,
            elevation,
            transition_altitude,
            geo_position: (lat, long),
            name,
            hide_tag
        })
    }
}
