use anyhow::anyhow;

use crate::aurora::gdf::Statement;
use crate::aurora::sector::parsing::parse_string_position;
use open_air::domain;
use crate::aurora::sector::Sector;
use std::collections::VecDeque;

const FEET_TO_METRES: f32 = 0.3048;

#[derive(Debug, Clone)]
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
        let geo_position = parse_string_position(&mut parts)?;
        let name = parts.next()
            .ok_or_else(|| anyhow!("missing airfield name"))?
            .to_owned();
        let hide_tag = parts.next().map_or(false, |v| v == "1");

        Ok(Airport {
            identifier,
            elevation,
            transition_altitude,
            geo_position,
            name,
            hide_tag,
        })
    }
}

#[derive(Debug, Clone)]
pub struct Runway {
    pub airport: String,
    pub primary_number: String,
    pub opposite_number: String,
    pub primary_elevation: f32,
    pub opposite_elevation: f32,
    pub primary_course: f32,
    pub opposite_course: f32,
    pub primary_position: (String, String),
    pub opposite_position: (String, String),
}

impl Runway {
    pub fn parse(statement: &Statement) -> anyhow::Result<Runway> {
        let mut parts = statement.parts();

        let airport = parts.next()
            .ok_or_else(|| anyhow!("missing airport"))?
            .to_owned();
        let primary_number = parts.next()
            .ok_or_else(|| anyhow!("missing primary number"))?
            .to_owned();
        let opposite_number = parts.next()
            .ok_or_else(|| anyhow!("missing opposite number"))?
            .to_owned();
        let primary_elevation = parts.next()
            .ok_or_else(|| anyhow!("missing primary elevation"))?
            .parse::<f32>()?;
        let opposite_elevation = parts.next()
            .ok_or_else(|| anyhow!("missing opposite elevation"))?
            .parse::<f32>()?;
        let primary_course = parts.next()
            .ok_or_else(|| anyhow!("missing primary course"))?
            .parse::<f32>()?;
        let opposite_course = parts.next()
            .ok_or_else(|| anyhow!("missing opposite course"))?
            .parse::<f32>()?;
        let primary_position = parse_string_position(&mut parts)?;
        let opposite_position = parse_string_position(&mut parts)?;

        Ok(Runway {
            airport,
            primary_number,
            opposite_number,
            primary_elevation,
            opposite_elevation,
            primary_course,
            opposite_course,
            primary_position,
            opposite_position,
        })
    }

    pub fn to_domain(&self, sector: &Sector) -> anyhow::Result<domain::Runway> {
        let primary_id = self.primary_number.to_string();
        let opposite_id = self.opposite_number.to_string();

        let pt_a = sector.lookup_map_position(
            &self.primary_position.0,
            &self.primary_position.1)?;
        let pt_b = sector.lookup_map_position(
            &self.opposite_position.0,
            &self.opposite_position.1)?;

        let elevation_a = self.primary_elevation * FEET_TO_METRES;
        let elevation_b = self.opposite_elevation * FEET_TO_METRES;

        let a = (pt_a.0, pt_a.1, elevation_a);
        let b = (pt_b.0, pt_b.1, elevation_b);

        Ok(domain::Runway {
            primary_id,
            opposite_id,
            primary_course: self.primary_course,
            opposite_course: self.opposite_course,
            points: [a, b],
        })
    }
}

#[derive(Debug, Clone)]
pub struct Taxiway {
    pub airport: String,
    pub identifier: String,
    pub geo_position: (String, String),
}

impl Taxiway {
    pub fn parse(statement: &Statement) -> anyhow::Result<Taxiway> {
        let mut parts = statement.parts()
            .collect::<VecDeque<_>>();

        let identifier = parts.pop_front()
            .ok_or_else(|| anyhow!("missing identifier"))?
            .to_owned();
        let airport = if parts.len() > 2 {
            parts.pop_front()
                .ok_or_else(|| anyhow!("missing airport"))?
                .to_owned()
        } else {
            "".to_owned()
        };
        let geo_position = parse_string_position(&mut parts.into_iter())?;

        Ok(Taxiway {
            airport,
            identifier,
            geo_position,
        })
    }

    pub fn to_label(&self, sector: &Sector) -> anyhow::Result<domain::viewer::Label> {
        let map_position = sector.lookup_map_position(
            &self.geo_position.0,
            &self.geo_position.1)?;
        let map_aabb = (map_position.0, map_position.1, map_position.0, map_position.1);

        Ok(domain::viewer::Label {
            text: self.identifier.to_string(),
            font_size: 6.0,
            map_position,
            map_aabb,
            filter: Default::default(),
        })
    }
}

#[derive(Debug, Clone)]
pub struct Gate {
    pub airport: String,
    pub identifier: String,
    pub geo_position: (String, String),
    pub gate_type: Option<String>,
}

impl Gate {
    pub fn parse(statement: &Statement) -> anyhow::Result<Gate> {
        let mut parts = statement.parts();

        let identifier = parts.next()
            .ok_or_else(|| anyhow!("missing identifier"))?
            .to_owned();
        let airport = parts.next()
            .ok_or_else(|| anyhow!("missing airport"))?
            .to_owned();
        let geo_position = parse_string_position(&mut parts)?;
        let gate_type = parts.next()
            .map(String::from);

        Ok(Gate {
            airport,
            identifier,
            geo_position,
            gate_type,
        })
    }

    pub fn to_label(&self, sector: &Sector) -> anyhow::Result<domain::viewer::Label> {
        let map_position = sector.lookup_map_position(
            &self.geo_position.0,
            &self.geo_position.1)?;
        let map_aabb = (map_position.0, map_position.1, map_position.0, map_position.1);

        Ok(domain::viewer::Label {
            text: self.identifier.to_string(),
            font_size: 4.0,
            map_position,
            map_aabb,
            filter: Default::default(),
        })
    }
}
