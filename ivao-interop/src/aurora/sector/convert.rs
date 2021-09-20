use crate::aurora::sector::Sector;
use open_air::domain::viewer::{SectionBuilder, Shape};

fn truncate(v: f64, scale: f64) -> f64 {
    (v * scale).trunc() / scale
}

fn truncate_pair(v: (f64, f64), scale: f64) -> (f64, f64) {
    (truncate(v.0, scale), truncate(v.1, scale))
}

impl Sector {
    pub fn convert(&self, builder: &mut SectionBuilder) -> anyhow::Result<()> {
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
                    stroke_colour: geo.color.as_ref().map(|c| c.capitalise()),
                    stroke_width: 1.0,
                    map_points: vec![level_start, level_end],
                    ..Default::default()
                };
                shape.recalculate_aabb();

                builder.apply_by_aabb(level, (start.0, start.1, end.0, end.1), |section| {
                    section.shapes.push(shape.clone());
                });
            }
        }

        Ok(())
    }
}