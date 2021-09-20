use std::convert::{TryFrom, TryInto};

use anyhow::anyhow;

use open_air::domain;
use open_air::domain::PointKind;

use crate::aurora::gdf::Statement;
use crate::aurora::sector::parsing::parse_string_position;
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
        let fix_type = parts.next()
            .ok_or_else(|| anyhow!("missing fix type"))?
            .parse::<i32>()?
            .try_into()?;
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
            position,
        })
    }
}
