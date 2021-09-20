use anyhow::anyhow;
use crate::aurora::gdf::{parse_longitude, parse_latitude};

pub fn parse_position<'a>(src: &mut impl Iterator<Item=&'a str>) -> anyhow::Result<(f64, f64)> {
    let latitude = parse_latitude(src.next()
        .ok_or_else(|| anyhow!("missing latitude"))?)?;
    let longitude = parse_longitude(src.next()
        .ok_or_else(|| anyhow!("missing longitude"))?)?;
    Ok((latitude, longitude))
}

pub fn parse_string_position<'a>(src: &mut impl Iterator<Item=&'a str>) -> anyhow::Result<(String, String)> {
    let latitude = src.next()
        .ok_or_else(|| anyhow!("missing latitude"))?
        .to_owned();
    let longitude = src.next()
        .ok_or_else(|| anyhow!("missing longitude"))?
        .to_owned();
    Ok((latitude, longitude))
}
