use std::f64::consts::PI;

pub fn geo_to_map(latitude: f64, longitude: f64) -> (f64, f64) {
    let x = (longitude + 180.) / 360.;
    let y = (PI - ((PI / 4.) + (latitude.to_radians() / 2.)).tan().ln())
        / (2. * PI);
    (x, y)
}

pub fn map_to_geo(x: f64, y: f64) -> (f64, f64) {
    let longitude = (x * 360.) - 180.;
    let latitude = (((PI - (y * 2. * PI)).exp().atan() - (PI / 4.)) * 2.)
        .to_degrees();
    (latitude, longitude)
}

pub fn calculate_aabb(mut pts: impl Iterator<Item=(f64, f64)>) -> (f64, f64, f64, f64) {
    let mut aabb = if let Some((x, y)) = pts.next() {
        (x, y, x, y)
    } else {
        (0., 0., 0., 0.)
    };

    for pt in pts {
        aabb.0 = aabb.0.min(pt.0);
        aabb.1 = aabb.1.min(pt.1);
        aabb.2 = aabb.2.max(pt.0);
        aabb.3 = aabb.3.max(pt.1);
    }

    aabb
}
