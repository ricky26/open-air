use crate::aurora::sector::Sector;
use open_air::domain::viewer::{SectionBuilder, Shape};

impl Sector {
    pub fn convert(&self, builder: &mut SectionBuilder) -> anyhow::Result<()> {
        for geo in self.geo.iter() {
            let start = self.lookup_position(&geo.start.0, &geo.start.1)?;
            let end = self.lookup_position(&geo.end.0, &geo.end.1)?;

            let mut shape = Shape {
                stroke_colour: geo.color.clone(),
                stroke_width: 1.0,
                points: vec![start, end],
                ..Default::default()
            };
            shape.recalculate_aabb();

            builder.apply_by_aabb((start.0, start.1, end.0, end.1), |section| {
                section.shapes.push(shape.clone());
            });
        }

        Ok(())
    }
}