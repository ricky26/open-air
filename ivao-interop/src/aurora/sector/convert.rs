use std::collections::{BTreeMap, HashSet, VecDeque};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use anyhow::anyhow;
use log::warn;

use open_air::domain::{AirspaceLayer, AirwayKind};
use open_air::domain::viewer::{aabb_intersects, Colour, Label, normalise_aabb, SectionBuilder, Shape};

use crate::aurora::sector::Sector;

struct PartialPolygon {
    shape: Shape,
    points: VecDeque<(f64, f64)>,
}

impl PartialPolygon {
    pub fn new(colour: Option<Colour>) -> PartialPolygon {
        PartialPolygon {
            shape: Shape {
                stroke_colour: colour,
                stroke_width: 1.,
                ..Default::default()
            },
            points: VecDeque::new(),
        }
    }

    pub fn into_shape(self) -> Shape {
        let mut shape = self.shape;
        shape.map_points = self.points.into_iter().collect();
        shape.recalculate_aabb();
        shape
    }
}

struct PolygonBuilder {
    shapes: Vec<Option<PartialPolygon>>,
    ends: BTreeMap<(Option<Colour>, i32, i32), (usize, bool)>,
}

impl PolygonBuilder {
    pub fn new() -> PolygonBuilder {
        PolygonBuilder {
            shapes: Vec::new(),
            ends: BTreeMap::new(),
        }
    }

    pub fn truncate(src: f64) -> i32 {
        const SCALE: f64 = (1 << 28) as f64;
        (src * SCALE) as i32
    }

    pub fn point(src: (f64, f64)) -> (i32, i32) {
        (Self::truncate(src.0), Self::truncate(src.1))
    }

    pub fn key(colour: Option<Colour>, pt: (f64, f64)) -> (Option<Colour>, i32, i32) {
        let (x, y) = Self::point(pt);
        (colour, x, y)
    }

    pub fn insert(&mut self, colour: Option<Colour>, a: (f64, f64), b: (f64, f64)) {
        let a_key = PolygonBuilder::key(colour.clone(), a);
        let b_key = PolygonBuilder::key(colour.clone(), b);

        if a_key == b_key {
            return;
        }

        let a_match = self.ends.remove(&a_key);
        let b_match = self.ends.remove(&b_key);

        match (a_match, b_match) {
            (Some((a_idx, a_end)), Some((b_idx, b_end))) => {
                if a_idx == b_idx {
                    // Joining the polygon
                    let shape = self.shapes[a_idx].as_mut().unwrap();
                    let pt = shape.points[0];
                    shape.points.push_back(pt);
                } else {
                    // Merge two polygons
                    let poly_a = self.shapes[a_idx].as_ref().unwrap();
                    let poly_b = self.shapes[b_idx].as_ref().unwrap();

                    let mut points = VecDeque::with_capacity(poly_a.points.len() + poly_b.points.len());

                    if a_end {
                        points.extend(poly_a.points.iter().cloned());
                    } else {
                        points.extend(poly_a.points.iter().cloned().rev());
                    }

                    if b_end {
                        points.extend(poly_b.points.iter().cloned().rev());
                    } else {
                        points.extend(poly_b.points.iter().cloned());
                    }

                    // Renumber start
                    let key = PolygonBuilder::key(
                        poly_a.shape.stroke_colour.clone(),
                        *points.front().unwrap());
                    self.ends.insert(key, (a_idx, false)).unwrap();

                    // Renumber end
                    let key = PolygonBuilder::key(
                        poly_a.shape.stroke_colour.clone(),
                        *points.back().unwrap());
                    self.ends.insert(key, (a_idx, true)).unwrap();

                    self.shapes[a_idx].as_mut().unwrap().points = points;
                    self.shapes[b_idx] = None;
                }
            }
            (Some((idx, end)), None) => {
                let poly = self.shapes[idx].as_mut().unwrap();
                if end {
                    poly.points.push_back(b);
                } else {
                    poly.points.push_front(b);
                }

                self.ends.insert(b_key, (idx, end));
            }
            (None, Some((idx, end))) => {
                let poly = self.shapes[idx].as_mut().unwrap();
                if end {
                    poly.points.push_back(a);
                } else {
                    poly.points.push_front(a);
                }

                self.ends.insert(a_key, (idx, end));
            }
            (None, None) => {
                let idx = self.shapes.len();
                let mut poly = PartialPolygon::new(colour);
                poly.points.push_back(a);
                poly.points.push_back(b);
                self.shapes.push(Some(poly));
                self.ends.insert(a_key, (idx, false));
                self.ends.insert(b_key, (idx, true));
            }
        }
    }

    pub fn build(self) -> impl Iterator<Item=Shape> {
        self.shapes.into_iter()
            .filter(Option::is_some)
            .map(Option::unwrap)
            .map(PartialPolygon::into_shape)
    }
}

fn simplify_shape(builder: &SectionBuilder, shape: &mut Shape, level: i16) {
    if shape.map_points.len() < 2 || level >= builder.levels() - 1 {
        return;
    }

    let min_dist = 2.0f64.powf(-(level + 9) as f64);
    let min_dist_sqr = min_dist * min_dist;

    let mut new_points = Vec::with_capacity(shape.map_points.len());
    new_points.push(shape.map_points[0]);
    for i in 1..shape.map_points.len() - 1 {
        let a = shape.map_points[i - 1];
        let b = shape.map_points[i];

        let dx = a.0 - b.0;
        let dy = a.1 - b.1;
        let d2 = dx * dx + dy * dy;

        if d2 >= min_dist_sqr {
            new_points.push(b);
        }
    }
    new_points.push(shape.map_points.last().cloned().unwrap());
    shape.map_points = new_points;
}

impl Sector {
    pub fn convert(&self, builder: &mut SectionBuilder) -> anyhow::Result<()> {
        for (name, colour) in self.defines.iter() {
            let value = match colour {
                Colour::Value(value) => *value,
                Colour::Reference(_) =>
                    return Err(anyhow!("defines must not reference other palette entries")),
            };
            builder.global_mut().palette.0.insert(name.clone(), value);
        }

        for fill in self.fill_colors.iter() {
            for level in 0..builder.levels() {
                let mut shape = Shape {
                    stroke_colour: Some(fill.stroke_color.capitalise()),
                    stroke_width: fill.stroke_width,
                    fill_colour: Some(fill.fill_color.capitalise()),
                    ..Default::default()
                };

                for (lat, long) in fill.geo_points.iter() {
                    let pt = builder.truncate_2xf64(
                        level, self.lookup_map_position(lat, long)?);

                    if shape.map_points.last() == Some(pt).as_ref() {
                        continue;
                    }

                    shape.map_points.push(pt);
                }

                if shape.map_points.len() < 2 {
                    continue;
                }
                shape.recalculate_aabb();

                if !builder.include_aabb(level, shape.map_aabb) {
                    continue;
                }

                builder.apply_by_aabb(level, shape.map_aabb, |section| {
                    section.shapes.push(shape.clone());
                });
            }
        }

        for level in 0..builder.levels() {
            let mut seen = HashSet::with_capacity(self.geo.len());
            let mut poly_builder = PolygonBuilder::new();

            for geo in self.geo.iter() {
                let start = builder.truncate_2xf64(
                    level, self.lookup_map_position(&geo.start.0, &geo.start.1)?);
                let end = builder.truncate_2xf64(
                    level, self.lookup_map_position(&geo.end.0, &geo.end.1)?);
                if start == end {
                    continue;
                }

                let (start, end) = if start > end {
                    (end, start)
                } else {
                    (start, end)
                };

                let colour = geo.color.as_ref().map(Colour::capitalise);

                let hash = {
                    let mut hasher = DefaultHasher::new();
                    colour.hash(&mut hasher);
                    PolygonBuilder::point(start).hash(&mut hasher);
                    PolygonBuilder::point(end).hash(&mut hasher);
                    hasher.finish()
                };

                if seen.contains(&hash) {
                    continue;
                }
                seen.insert(hash);
                poly_builder.insert(colour, start, end);
            }

            for mut shape in poly_builder.build() {
                if shape.map_points.len() < 2 || !builder.include_aabb(level, shape.map_aabb) {
                    continue;
                }

                simplify_shape(builder, &mut shape, level);

                builder.apply_by_aabb(level, shape.map_aabb, |section| {
                    // If we're encompassed, just use the original shape.
                    if shape.map_aabb.0 >= section.map_aabb.0
                        && shape.map_aabb.1 >= section.map_aabb.1
                        && shape.map_aabb.2 <= section.map_aabb.2
                        && shape.map_aabb.3 <= section.map_aabb.3 {
                        section.shapes.push(shape.clone());
                        return;
                    }

                    // Otherwise, split it into pieces.
                    let mut to_insert = None;

                    for i in 0..shape.map_points.len() {
                        let b = shape.map_points[i];
                        let a = if i > 0 {
                            shape.map_points.get(i - 1)
                                .cloned()
                                .unwrap_or(b)
                        } else {
                            b
                        };
                        let c = shape.map_points.get(i + 1)
                            .cloned()
                            .unwrap_or(b);

                        let x0 = a.0.min(b.0).min(c.0);
                        let x1 = a.0.max(b.0).max(c.0);
                        let y0 = a.1.min(b.1).min(c.1);
                        let y1 = a.1.max(b.1).max(c.1);
                        let aabb = (x0, y0, x1, y1);

                        if aabb_intersects(aabb, section.map_aabb) {
                            if to_insert.is_none() {
                                to_insert = Some(Shape {
                                    fill_colour: shape.fill_colour.clone(),
                                    stroke_colour: shape.stroke_colour.clone(),
                                    stroke_width: shape.stroke_width,
                                    map_points: Vec::new(),
                                    filter: shape.filter.clone(),
                                    map_aabb: shape.map_aabb,
                                });
                            }

                            let shape = to_insert.as_mut().unwrap();
                            shape.map_points.push(b);
                        } else if let Some(mut shape) = to_insert.take() {
                            shape.recalculate_aabb();
                            section.shapes.push(shape);
                        }
                    }

                    if let Some(mut shape) = to_insert {
                        shape.recalculate_aabb();
                        section.shapes.push(shape);
                    }
                });
            }
        }

        for airport in self.airports.iter() {
            if airport.hide_tag {
                continue;
            }

            let map_position = self.lookup_map_position(
                &airport.geo_position.0, &airport.geo_position.1)?;
            let map_aabb = (map_position.0, map_position.1, map_position.0, map_position.1);
            let label = Label {
                text: airport.identifier.clone(),
                font_size: 8.,
                map_position,
                filter: Default::default(),
                map_aabb,
            };

            for level in 0..builder.levels() {
                builder.apply_by_aabb(level, map_aabb, |section| {
                    section.labels.push(label.clone());
                });
            }
        }

        for runway in self.runways.iter() {
            let domain = runway.to_domain(self)?;
            let aabb = normalise_aabb((
                domain.points[0].0,
                domain.points[0].1,
                domain.points[1].0,
                domain.points[1].1,
            ));

            for level in 0..builder.levels() {
                if !builder.include_aabb(level, aabb) {
                    continue
                }

                builder.apply_by_aabb(level, aabb, |section| {
                    section.runways.push(domain.clone());
                });
            }
        }

        for gate in self.gates.iter() {
            let domain = gate.to_label(self)?;
            for level in 7..builder.levels() {
                builder.apply_by_aabb(level, domain.map_aabb, |section| {
                    section.labels.push(domain.clone());
                });
            }
        }

        for taxiway in self.taxiways.iter() {
            let domain = taxiway.to_label(self)?;
            for level in 6..builder.levels() {
                builder.apply_by_aabb(level, domain.map_aabb, |section| {
                    section.labels.push(domain.clone());
                });
            }
        }

        let fixes = self.fixes.iter().map(|s| (&s.identifier, s.to_domain(self)))
            .chain(self.ndbs.iter().map(|s| (&s.identifier, s.to_domain(self))))
            .chain(self.vors.iter().map(|s| (&s.identifier, s.to_domain(self))))
            .chain(self.vrps.iter().map(|s| (&s.identifier, s.to_domain(self))));
        for (name, fix) in fixes {
            let domain = match fix {
                Ok(v) => v,
                Err(err) => {
                    warn!("error converting fix {}: {}", name, err);
                    continue;
                }
            };
            let aabb = (
                domain.position.0,
                domain.position.1,
                domain.position.0,
                domain.position.1,
            );
            for level in 3..builder.levels() {
                builder.apply_by_aabb(level, aabb, |section| {
                    section.points.push(domain.clone());
                });
            }
        }

        let airspaces = self.airspaces.iter()
            .map(|a| (&a.identifier, a.to_domain(self, AirspaceLayer::Default)))
            .chain(self.airspaces_high.iter()
                .map(|a| (&a.identifier, a.to_domain(self, AirspaceLayer::High))))
            .chain(self.airspaces_low.iter()
                .map(|a| (&a.identifier, a.to_domain(self, AirspaceLayer::Low))));
        for (name, airspace) in airspaces {
            let domain = match airspace {
                Ok(v) => v,
                Err(err) => {
                    warn!("error converting airspace {}: {}", name, err);
                    continue;
                }
            };

            for level in 3..builder.levels() {
                builder.apply_by_aabb(level, domain.aabb, |section| {
                    section.airspaces.push(domain.clone());
                });
            }
        }

        let airways = self.airways_high.iter()
            .map(|a| (&a.identifier, a.to_domain(self, AirwayKind::High)))
            .chain(self.airways_low.iter()
                .map(|a| (&a.identifier, a.to_domain(self, AirwayKind::Low))));
        for (name, airway) in airways {
            let domain = match airway {
                Ok(v) => v,
                Err(err) => {
                    warn!("error converting airway {}: {}", name, err);
                    continue;
                }
            };

            for level in 3..builder.levels() {
                builder.apply_by_aabb(level, domain.aabb, |section| {
                    section.airways.push(domain.clone());
                });
            }
        }

        Ok(())
    }
}
