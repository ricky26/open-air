use std::convert::{TryFrom, TryInto};

use anyhow::anyhow;

use open_air::domain;
use open_air::domain::PointKind;

use crate::aurora::gdf::Statement;
use crate::aurora::sector::parsing::{frequency_to_int, parse_string_position};
use crate::aurora::sector::Sector;

#[derive(Debug, Clone, Copy)]
pub enum FixType {
    Enroute = 0,
    Terminal = 1,
    Both = 2,
    Hidden = 3,
}

impl From<FixType> for domain::FixKind {
    fn from(value: FixType) -> Self {
        match value {
            FixType::Enroute => domain::FixKind::Enroute,
            FixType::Terminal => domain::FixKind::Terminal,
            FixType::Both => domain::FixKind::Both,
            FixType::Hidden => domain::FixKind::Hidden,
        }
    }
}

impl TryFrom<i32> for FixType {
    type Error = anyhow::Error;

    fn try_from(value: i32) -> anyhow::Result<Self> {
        Ok(match value {
            0 => FixType::Enroute,
            1 => FixType::Terminal,
            2 => FixType::Both,
            3 => FixType::Hidden,
            _ => return Err(anyhow!("invalid fix type {}", value)),
        })
    }
}

#[derive(Debug, Clone)]
pub struct Fix {
    pub identifier: String,
    pub geo_position: (String, String),
    pub fix_type: FixType,
    pub boundary: bool,
}

impl Fix {
    pub fn parse(statement: &Statement) -> anyhow::Result<Fix> {
        let mut parts = statement.parts();

        let identifier = parts.next()
            .ok_or_else(|| anyhow!("missing identifier"))?
            .to_owned();
        let geo_position = parse_string_position(&mut parts)?;
        let fix_type = match parts.next() {
            Some(value) => value.parse::<i32>()?.try_into()?,
            None => FixType::Hidden,
        };
        let boundary = parts.next() == Some("1");

        Ok(Fix {
            identifier,
            geo_position,
            fix_type,
            boundary,
        })
    }

    pub fn to_domain(&self, sector: &Sector) -> anyhow::Result<domain::Point> {
        let position = sector.lookup_map_position(
            &self.geo_position.0,
            &self.geo_position.1)?;
        Ok(domain::Point {
            kind: PointKind::FIX {
                kind: self.fix_type.into(),
                is_boundary: self.boundary,
            },
            name: self.identifier.clone(),
            map_position: position,
        })
    }
}

#[derive(Debug, Clone)]
pub struct NDB {
    pub identifier: String,
    pub frequency: String,
    pub geo_position: (String, String),
}

impl NDB {
    pub fn parse(statement: &Statement) -> anyhow::Result<NDB> {
        let mut parts = statement.parts();

        let identifier = parts.next()
            .ok_or_else(|| anyhow!("missing identifier"))?
            .to_owned();
        let frequency = parts.next()
            .ok_or_else(|| anyhow!("missing frequency"))?
            .to_owned();
        let geo_position = parse_string_position(&mut parts)?;

        Ok(NDB {
            identifier,
            frequency,
            geo_position,
        })
    }

    pub fn to_domain(&self, sector: &Sector) -> anyhow::Result<domain::Point> {
        let position = sector.lookup_map_position(
            &self.geo_position.0,
            &self.geo_position.1)?;
        Ok(domain::Point {
            kind: PointKind::NDB {
                frequency: frequency_to_int(&self.frequency)?,
            },
            name: self.identifier.clone(),
            map_position: position,
        })
    }
}


#[derive(Debug, Clone)]
pub struct VOR {
    pub identifier: String,
    pub frequency: String,
    pub geo_position: (String, String),
}

impl VOR {
    pub fn parse(statement: &Statement) -> anyhow::Result<VOR> {
        let mut parts = statement.parts();

        let identifier = parts.next()
            .ok_or_else(|| anyhow!("missing identifier"))?
            .to_owned();
        let frequency = parts.next()
            .ok_or_else(|| anyhow!("missing frequency"))?
            .to_owned();
        let geo_position = parse_string_position(&mut parts)?;

        Ok(VOR {
            identifier,
            frequency,
            geo_position,
        })
    }

    pub fn to_domain(&self, sector: &Sector) -> anyhow::Result<domain::Point> {
        let position = sector.lookup_map_position(
            &self.geo_position.0,
            &self.geo_position.1)?;
        Ok(domain::Point {
            kind: PointKind::VOR {
                frequency: frequency_to_int(&self.frequency)?,
            },
            name: self.identifier.clone(),
            map_position: position,
        })
    }
}


#[derive(Debug, Clone)]
pub struct VRP {
    pub identifier: String,
    pub altitude: Option<(f32, f32)>,
    pub geo_position: (String, String),
}

impl VRP {
    fn parse_range(src: &str) -> anyhow::Result<(f32, f32)> {
        let range = if let Some(position) = src.find('-') {
            let min_str = &src[..position];
            let max_str = &src[position + 1..];
            let min = min_str.trim().parse::<f32>()?;
            let max = max_str.trim().parse::<f32>()?;
            (min, max)
        } else {
            let v = src.parse::<f32>()?;
            (v, v)
        };
        Ok(range)
    }

    pub fn parse(statement: &Statement) -> anyhow::Result<VRP> {
        let mut parts = statement.parts();

        let identifier = parts.next()
            .ok_or_else(|| anyhow!("missing VRP identifier"))?
            .to_owned();
        let altitude = parts.next()
            .filter(|s| !s.is_empty())
            .map(|part| VRP::parse_range(part))
            .transpose()
            .map_err(|e| anyhow!("failed to parse VRP range {}: {}", statement.as_str(), e))?;
        let geo_position = parse_string_position(&mut parts)?;

        Ok(VRP {
            identifier,
            altitude,
            geo_position,
        })
    }

    pub fn to_domain(&self, sector: &Sector) -> anyhow::Result<domain::Point> {
        let position = sector.lookup_map_position(
            &self.geo_position.0,
            &self.geo_position.1)?;
        Ok(domain::Point {
            kind: PointKind::VRP {
                altitude: self.altitude,
            },
            name: self.identifier.clone(),
            map_position: position,
        })
    }
}
