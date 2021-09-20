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
            start: (start_lat, start_long),
            end: (end_lat, end_long),
            color,
        })
    }
}

pub struct FillColor {
    pub poly_type: String,
    pub fill_color: Colour,
    pub stroke_width: f32,
    pub stroke_color: Colour,
    pub fill_color_clear: bool,
    pub filter: String,
    pub geo_points: Vec<(String, String)>,
}

impl FillColor {
    pub fn parse(statement: &Statement) -> anyhow::Result<FillColor> {
        let mut parts = statement.parts();

        let poly_type = parts.next()
            .ok_or_else(|| anyhow!("missing polygon type"))?
            .to_owned();
        let fill_color = parse_colour(parts.next()
            .ok_or_else(|| anyhow!("missing fill colour"))?)?;
        let stroke_width = parts.next()
            .ok_or_else(|| anyhow!("missing stroke width"))?
            .parse::<f32>()?;
        let stroke_color = parse_colour(parts.next()
            .ok_or_else(|| anyhow!("missing stroke colour"))?)?;
        let fill_color_clear = parts.next().map_or(false, |v| v == "1");
        let filter = parts.next()
            .map_or(String::new(), |v| v.to_owned());

        Ok(FillColor {
            poly_type,
            fill_color,
            stroke_width,
            stroke_color,
            fill_color_clear,
            filter,
            geo_points: vec![],
        })
    }

    pub fn add_point(&mut self, statement: &Statement) -> anyhow::Result<bool> {
        if statement.parts().count() < 4 {
            let mut parts = statement.parts();
            let lat = parts.next()
                .ok_or_else(|| anyhow!("missing latitude"))?
                .to_owned();
            let long = parts.next()
                .ok_or_else(|| anyhow!("missing longitude"))?
                .to_owned();

            self.geo_points.push((lat, long));
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn from_iterator(dest: &mut Vec<FillColor>, src: impl Iterator<Item=anyhow::Result<Statement>>) -> anyhow::Result<()> {
        let mut current: Option<FillColor> = None;

        let mut flush = |value: &mut Option<FillColor>| {
            if let Some(value) = value.take() {
                dest.push(value);
            }
        };

        for statement in src {
            let statement = statement?;
            let did_add = current.as_mut()
                .map(|c| c.add_point(&statement))
                .transpose()?
                .unwrap_or(false);
            if !did_add {
                flush(&mut current);
                current = Some(FillColor::parse(&statement)?);
            }
        }

        flush(&mut current);
        Ok(())
    }
}
