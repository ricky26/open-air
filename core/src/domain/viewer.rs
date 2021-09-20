//! Types which have no functional effect on the system, such as airport geometry.
use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::domain::{Airspace, Point};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Palette(pub HashMap<String, u32>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Colour {
    Reference(String),
    Value(u32),
}

impl Colour {
    pub fn capitalise(&self) -> Self {
        match self {
            Colour::Value(v) => Colour::Value(*v),
            Colour::Reference(name) => Colour::Reference(name.to_uppercase()),
        }
    }
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
    pub map_position: (f64, f64),

    pub filter: LayerFilter,
    pub map_aabb: (f64, f64, f64, f64),
}

impl Label {
    pub fn recalculate_aabb(&mut self) {
        let (x, y) = self.map_position;
        self.map_aabb = (x - 1., y - 1., x + 1., y + 1.);
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shape {
    pub fill_colour: Option<Colour>,
    pub stroke_colour: Option<Colour>,
    pub stroke_width: f32,
    pub map_points: Vec<(f64, f64)>,

    pub filter: LayerFilter,
    pub map_aabb: (f64, f64, f64, f64),
}

impl Shape {
    pub fn recalculate_aabb(&mut self) {
        let mut points = self.map_points.iter().cloned();
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

        self.map_aabb = aabb;
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
    pub division: (i16, i16, i16),
    pub map_aabb: (f64, f64, f64, f64),

    pub labels: Vec<Label>,
    pub shapes: Vec<Shape>,

    pub points: Vec<Point>,
    pub airspaces: Vec<Airspace>,
}

pub struct SectionBuilder {
    global: Global,
    levels: i16,
    sections: HashMap<(i16, i16, i16), Section>,
}

impl SectionBuilder {
    pub fn new(levels: i16) -> SectionBuilder {
        SectionBuilder {
            global: Global::default(),
            levels,
            sections: HashMap::new(),
        }
    }

    pub fn levels(&self) -> i16 {
        self.levels
    }

    pub fn global_mut(&mut self) -> &mut Global {
        &mut self.global
    }

    fn create_section(&mut self, level: i16, x: i16, y: i16) -> &mut Section {
        if !self.sections.contains_key(&(level, x, y)) {
            let divisions = 1 << level;
            let scale = 1. / (divisions as f64);

            self.sections.insert((level, x, y), Section {
                division: (level, x, y),
                map_aabb: (
                    (x as f64) * scale,
                    (y as f64) * scale,
                    ((x + 1) as f64) * scale,
                    ((y + 1) as f64) * scale,
                ),
                ..Default::default()
            });
        }

        self.sections.get_mut(&(level, x, y)).unwrap()
    }

    pub fn apply_by_aabb(&mut self, level: i16, aabb: (f64, f64, f64, f64), mut f: impl FnMut(&mut Section)) {
        let divisions = 1 << level;
        let scale = 1. / (divisions as f64);
        let x_min = (aabb.0.min(aabb.2) / scale).floor() as i16;
        let x_max = (aabb.0.max(aabb.2) / scale).ceil() as i16;
        let y_min = (aabb.1.min(aabb.3) / scale).floor() as i16;
        let y_max = (aabb.1.max(aabb.3) / scale).ceil() as i16;

        for x in x_min..x_max {
            for y in y_min..y_max {
                f(self.create_section(level, x, y));
            }
        }
    }

    pub fn build(self) -> (Global, Vec<Section>) {
        (self.global, self.sections.into_values().collect())
    }
}
