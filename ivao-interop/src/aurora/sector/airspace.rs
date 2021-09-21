use std::collections::HashMap;

use anyhow::anyhow;

use open_air::domain;
use open_air::domain::coords::calculate_aabb;

use crate::aurora::gdf::Statement;
use crate::aurora::sector::parsing::{parse_string_position, convert_geo_points};
use crate::aurora::sector::Sector;

#[derive(Debug, Clone)]
pub struct AirspaceLabel {
    pub geo_position: (String, String),
    pub font_size: Option<f32>,
}

#[derive(Debug, Clone)]
pub struct Airspace {
    pub identifier: String,
    pub geo_points: Vec<(String, String)>,
    pub labels: Vec<AirspaceLabel>,
}

impl Airspace {
    pub fn to_domain(&self, sector: &Sector, layer: domain::AirspaceLayer) -> anyhow::Result<domain::Airspace> {
        let points = convert_geo_points(sector, self.geo_points.iter())?;
        let aabb = calculate_aabb(points.iter().cloned());
        let labels = self.labels.iter()
            .map(|label| -> anyhow::Result<_> {
                let map_position = sector.lookup_map_position(
                    &label.geo_position.0,
                    &label.geo_position.1)?;
                Ok(domain::AirspaceLabel {
                    map_position,
                    font_size: label.font_size.unwrap_or(4.0),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(domain::Airspace {
            id: self.identifier.to_string(),
            layer,
            points,
            aabb,
            labels,
        })
    }

    pub fn from_iterator(dest: &mut Vec<Airspace>, src: impl Iterator<Item=anyhow::Result<Statement>>) -> anyhow::Result<()> {
        let mut airspaces = HashMap::new();

        for statement in src {
            let statement = statement?;
            let mut parts = statement.parts();

            let is_label = match parts.next()
                .ok_or_else(|| anyhow!("missing airspace field type: {}", statement.as_str()))? {
                "T" | "t" => false,
                "L" | "l" => true,
                value => return Err(anyhow!("unexpected airspace field type: {}", value)),
            };
            let identifier = parts.next()
                .ok_or_else(|| anyhow!("missing airspace identifier"))?;
            let geo_position = parse_string_position(&mut parts)?;
            let font_size = parts.next()
                .and_then(|s| s.parse::<f32>().ok());

            if !airspaces.contains_key(identifier) {
                let airspace = Airspace {
                    identifier: identifier.to_string(),
                    geo_points: Vec::new(),
                    labels: Vec::new(),
                };
                airspaces.insert(identifier.to_string(), airspace);
            }
            let airspace = airspaces.get_mut(identifier).unwrap();

            if is_label {
                let label = AirspaceLabel {
                    geo_position,
                    font_size,
                };
                airspace.labels.push(label);
            } else {
                airspace.geo_points.push(geo_position);
            }
        }

        dest.extend(airspaces.into_values());
        Ok(())
    }
}


#[derive(Debug, Clone)]
pub struct AirwayLabel {
    pub geo_position: (String, String),
}

#[derive(Debug, Clone)]
pub struct Airway {
    pub identifier: String,
    pub geo_points: Vec<(String, String)>,
    pub labels: Vec<AirwayLabel>,
}

impl Airway {
    pub fn to_domain(&self, sector: &Sector, kind: domain::AirwayKind) -> anyhow::Result<domain::Airway> {
        let points = convert_geo_points(sector, self.geo_points.iter())?;
        let aabb = calculate_aabb(points.iter().cloned());
        let labels = self.labels.iter()
            .map(|label| -> anyhow::Result<_> {
                let map_position = sector.lookup_map_position(
                    &label.geo_position.0,
                    &label.geo_position.1)?;
                Ok(domain::AirwayLabel {
                    map_position,
                })
            })
            .collect::<Result<Vec<_>, _>>()?;


        Ok(domain::Airway {
            name: self.identifier.to_string(),
            kind,
            points,
            aabb,
            labels,
        })
    }

    pub fn from_iterator(dest: &mut Vec<Airway>, src: impl Iterator<Item=anyhow::Result<Statement>>) -> anyhow::Result<()> {
        let mut airways = HashMap::new();

        for statement in src {
            let statement = statement?;
            let mut parts = statement.parts();

            let is_label = match parts.next()
                .ok_or_else(|| anyhow!("missing airway field type: {}", statement.as_str()))? {
                "T" | "t" => false,
                "L" | "l" => true,
                value => return Err(anyhow!("unexpected airway field type: {}", value)),
            };
            let identifier = parts.next()
                .ok_or_else(|| anyhow!("missing airway identifier"))?;
            let geo_position = parse_string_position(&mut parts)?;

            if !airways.contains_key(identifier) {
                let airway = Airway {
                    identifier: identifier.to_string(),
                    geo_points: Vec::new(),
                    labels: Vec::new(),
                };
                airways.insert(identifier.to_string(), airway);
            }
            let airway = airways.get_mut(identifier).unwrap();

            if is_label {
                let label = AirwayLabel {
                    geo_position,
                };
                airway.labels.push(label);
            } else {
                airway.geo_points.push(geo_position);
            }
        }

        dest.extend(airways.into_values());
        Ok(())
    }
}
