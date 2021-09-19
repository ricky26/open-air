//! Types which have no functional effect on the system, such as airport geometry.
use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use crate::domain::{Point, Airspace};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Palette(pub HashMap<String, u32>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Colour {
    Reference(String),
    Value(u32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LayerFilterOp {
    #[serde(rename = "!")]
    Not,
    #[serde(rename = "&")]
    And,
    #[serde(rename = "|")]
    Or,
    #[serde(rename = "#")]
    Layer(String),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerFilter(pub Vec<LayerFilterOp>);

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub text: String,
    pub font_size: f32,
    pub position: (f64, f64),

    pub filter: LayerFilter,
    pub aabb: (f64, f64, f64, f64),
}

impl Label {
    pub fn recalculate_aabb(&mut self) {
        let (x, y) = self.position;
        self.aabb = (x - 1., y - 1., x + 1., y + 1.);
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shape {
    pub fill_colour: Option<Colour>,
    pub stroke_colour: Option<Colour>,
    pub stroke_width: f32,
    pub points: Vec<(f64, f64)>,

    pub filter: LayerFilter,
    pub aabb: (f64, f64, f64, f64),
}

impl Shape {
    pub fn recalculate_aabb(&mut self) {
        let mut points = self.points.iter().cloned();
        let mut aabb = match points.next() {
            Some((x, y)) => (x, y, x, y),
            None => (0., 0., 0., 0.),
        };

        for (x, y) in points {
            aabb.0 = aabb.0.min(x);
            aabb.1 = aabb.1.min(y);
            aabb.2 = aabb.2.max(x);
            aabb.3 = aabb.3.max(y);
        }

        self.aabb = aabb;
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Global {
    pub palette: Palette,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub aabb: (f64, f64, f64, f64),

    pub labels: Vec<Label>,
    pub shapes: Vec<Shape>,

    pub points: Vec<Point>,
    pub airspaces: Vec<Airspace>,
}

pub struct SectionBuilder {
    global: Global,
    sections: HashMap<(i16, i16), Section>,
}

impl SectionBuilder {
    const SCALE: f64 = 10.;

    pub fn new() -> SectionBuilder {
        SectionBuilder {
            global: Global::default(),
            sections: HashMap::new(),
        }
    }

    pub fn global_mut(&mut self) -> &mut Global {
        &mut self.global
    }

    fn create_section(&mut self, x: i16, y: i16) -> &mut Section {
        if !self.sections.contains_key(&(x, y)) {
            self.sections.insert((x, y), Section{
                aabb: (
                    (x as f64) * Self::SCALE,
                    (y as f64) * Self::SCALE,
                    ((x + 1) as f64) * Self::SCALE,
                    ((y + 1) as f64) * Self::SCALE,
                ),
                ..Default::default()
            });
        }

        self.sections.get_mut(&(x, y)).unwrap()
    }

    pub fn apply_by_aabb(&mut self, aabb: (f64, f64, f64, f64), mut f: impl FnMut(&mut Section)) {
        let x_min = (aabb.0.min(aabb.2) / Self::SCALE).floor() as i16;
        let x_max = (aabb.0.max(aabb.2) / Self::SCALE).ceil() as i16;
        let y_min = (aabb.1.min(aabb.3) / Self::SCALE).floor() as i16;
        let y_max = (aabb.1.max(aabb.3) / Self::SCALE).ceil() as i16;

        for x in x_min..x_max {
            for y in y_min..y_max {
                f(self.create_section(x, y));
            }
        }
    }

    pub fn build(self) -> (Global, Vec<Section>) {
        (self.global, self.sections.into_values().collect())
    }
}
