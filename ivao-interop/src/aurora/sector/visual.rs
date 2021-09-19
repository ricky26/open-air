use anyhow::anyhow;
use log::warn;

use open_air::domain::viewer::Colour;

use crate::aurora::gdf::{parse_colour, Statement};

pub struct Geo {
    pub start: (String, String),
    pub end: (String, String),
    pub color: Option<Colour>,
}

impl Geo {
    pub fn parse(statement: &Statement) -> anyhow::Result<Geo> {
        let mut parts = statement.parts();

        let start_lat = parts.next()
            .ok_or_else(|| anyhow!("missing latitude"))?
            .to_owned();
        let start_long = parts.next()
            .ok_or_else(|| anyhow!("missing longitude"))?
            .to_owned();
        let end_lat = parts.next()
            .ok_or_else(|| anyhow!("missing latitude"))?
            .to_owned();
        let end_long = parts.next()
            .ok_or_else(|| anyhow!("missing longitude"))?
            .to_owned();

        let color = parts.next()
            .map(parse_colour)
            .transpose()?;

        if let Some(value) = parts.next() {
            warn!("unexpected data at end of statement: {}", value);
        }

        Ok(Geo {
            start: (start_long, start_lat),
            end: (end_long, end_lat),
            color,
        })
    }
}