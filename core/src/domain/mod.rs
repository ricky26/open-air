//! Descriptions for the types in the domain.

use serde::{Deserialize, Serialize};

pub mod viewer;
pub mod coords;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FixKind {
    Enroute,
    Terminal,
    Both,
    Hidden,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PointKind {
    FIX { kind: FixKind, is_boundary: bool },
    VOR { frequency: u16 },
    NBD { frequency: u16 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    #[serde(flatten)]
    pub kind: PointKind,

    pub name: String,
    pub position: (f64, f64),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ATC {
    pub position: String,
    pub frequency: u16,
    pub transfer_allow: Vec<String>,
    pub transfer_deny: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Airport {
    pub identifier: String,
    pub elevation: f64,
    pub transition_altitude: f64,
    pub position: (f64, f64),
    pub name: String,
    pub hide_tag: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Runway {
    pub primary_id: String,
    pub opposite_id: String,
    pub primary_course: f32,
    pub opposite_course: f32,
    pub points: [(f64, f64, f32); 2],
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AirwayKind {
    Low,
    High,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Airway {
    pub kind: AirwayKind,
    pub name: String,
    pub points: Vec<(f64, f64)>,
    pub aabb: (f64, f64, f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AirspaceLayer {
    Default,
    Low,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Airspace {
    pub id: String,
    pub center: (f64, f64),
    pub layer: AirspaceLayer,
    pub points: Vec<(f64, f64)>,
    pub aabb: (f64, f64, f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sector {
    pub center: (f64, f64),
    pub ratio: (f64, f64),
    pub magnetic_variation: f64,
}
