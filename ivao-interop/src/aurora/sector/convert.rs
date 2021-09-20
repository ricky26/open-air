use crate::aurora::sector::Sector;
use open_air::domain::viewer::{SectionBuilder, Shape, Colour};

fn truncate(v: f64, scale: f64) -> f64 {
    (v * scale).trunc() / scale
}

fn truncate_pair(v: (f64, f64), scale: f64) -> (f64, f64) {
    (truncate(v.0, scale), truncate(v.1, scale))
}

impl Sector {
    pub fn convert(&self, builder: &mut SectionBuilder) -> anyhow::Result<()> {
        for fill in self.fill_colors.iter() {
            for level in 0..builder.levels() {
                let mut shape = Shape {
                    stroke_colour: Some(fill.stroke_color.capitalise()),
                    stroke_width: fill.stroke_width,
                    fill_colour: Some(fill.fill_color.capitalise()),
                    ..Default::default()
                };

                for (lat, long) in fill.geo_points.iter() {
                    let pt = self.lookup_map_position(lat, long)?;
                    let pt = if level < 7 {
                        let scale = ((1 << level) as f64) * 1024.;
                        truncate_pair(pt, scale)
                    } else {
                        pt
                    };

                    if shape.map_points.last() == Some(pt).as_ref() {
                        continue
                    }

                    shape.map_points.push(pt);
                }

                if shape.map_points.len() < 2 {
                    continue
                }
                shape.recalculate_aabb();

                builder.apply_by_aabb(level, shape.map_aabb, |section| {
                    section.shapes.push(shape.clone());
                });
            }
        }

        for geo in self.geo.iter() {
            let start = self.lookup_map_position(&geo.start.0, &geo.start.1)?;
            let end = self.lookup_map_position(&geo.end.0, &geo.end.1)?;

            for level in 0..builder.levels() {
                let (level_start, level_end) = if level < 7 {
                    let scale = ((1 << level) as f64) * 1024.;
                    (truncate_pair(start, scale), truncate_pair(end, scale))
                } else {
                    (start, end)
                };
                if level_start == level_end {
                    continue;
                }

                let mut shape = Shape {
                    stroke_colour: geo.color.as_ref().map(Colour::capitalise),
                    stroke_width: 1.0,
                    map_points: vec![level_start, level_end],
                    ..Default::default()
                };
                shape.recalculate_aabb();

                builder.apply_by_aabb(level, shape.map_aabb, |section| {
                    section.shapes.push(shape.clone());
                });
            }
        }

        Ok(())
    }
}