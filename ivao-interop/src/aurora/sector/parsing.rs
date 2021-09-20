use anyhow::anyhow;

pub fn parse_string_position<'a>(src: &mut impl Iterator<Item=&'a str>) -> anyhow::Result<(String, String)> {
    let latitude = src.next()
        .ok_or_else(|| anyhow!("missing latitude"))?
        .to_owned();
    let longitude = src.next()
        .ok_or_else(|| anyhow!("missing longitude"))?
        .to_owned();
    Ok((latitude, longitude))
}

pub fn frequency_to_int(freq: &str) -> anyhow::Result<u16> {
    let freq = if let Some(offset) = freq.find('.') {
        let just_digits = format!("{}{}", &freq[..offset], &freq[offset + 1..]);
        let value = 10u16.pow((freq.len() - offset) as u32);
        just_digits.parse::<u16>()? * (100 / value)
    } else {
        freq.parse::<u16>()?
    };
    Ok(freq)
}
