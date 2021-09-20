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
