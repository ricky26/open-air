//! Types which have no functional effect on the system, such as airport geometry.
use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::domain::{Airspace, Point};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Palette(pub HashMap<String, u32>);

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq, Ord, PartialOrd)]
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

    pub fn truncate_f64(&self, level: i16, v: f64) -> f64 {
        if level < self.levels() - 1 {
            let scale = (1 << ((level as i64) + 9)) as f64;
            (v * scale).round() / scale
        } else {
            v
        }
    }

    pub fn truncate_2xf64(&self, level: i16, v: (f64, f64)) -> (f64, f64) {
        (self.truncate_f64(level, v.0), self.truncate_f64(level, v.1))
    }

    pub fn include_aabb(&self, level: i16, aabb: (f64, f64, f64, f64)) -> bool {
        if level >= self.levels() - 1 {
            true
        } else {
            let min_size = 1. / ((1 << (level + 9)) as f64);
            let (min_x, min_y, max_x, max_y) = aabb;
            (max_x - min_x) >= min_size && (max_y - min_y) >= min_size
        }
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
        let divisions = (1 << level) as f64;
        let x_min = (aabb.0.min(aabb.2) * divisions).floor() as i16;
        let x_max = (aabb.0.max(aabb.2) * divisions).ceil() as i16;
        let y_min = (aabb.1.min(aabb.3) * divisions).floor() as i16;
        let y_max = (aabb.1.max(aabb.3) * divisions).ceil() as i16;

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

pub fn normalise_aabb(src: (f64, f64, f64, f64)) -> (f64, f64, f64, f64) {
    (src.0.min(src.2), src.1.min(src.3), src.0.max(src.2), src.1.max(src.3))
}

pub fn aabb_intersects(a: (f64, f64, f64, f64), b: (f64, f64, f64, f64)) -> bool {
    let a = normalise_aabb(a);
    let b = normalise_aabb(b);

    let aw = a.2 - a.0;
    let ah = a.3 - a.1;
    let acx = (a.0 + a.2) * 0.5;
    let acy = (a.1 + a.3) * 0.5;

    let bw = b.2 - b.0;
    let bh = b.3 - b.1;
    let bcx = (b.0 + b.2) * 0.5;
    let bcy = (b.1 + b.3) * 0.5;

    let dx = (acx - bcx).abs();
    let dy = (acy - bcy).abs();
    let width = 0.5 * (aw + bw);
    let height = 0.5 * (ah + bh);

    (dx < width) && (dy < height)
}
